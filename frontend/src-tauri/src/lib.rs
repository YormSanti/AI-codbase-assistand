use std::env;
use std::ffi::OsString;
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use tauri::{Manager, State, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct BackendState {
    port: u16,
    child: Mutex<Option<CommandChild>>,
}

#[tauri::command]
fn backend_url(state: State<'_, BackendState>) -> String {
    format!("http://127.0.0.1:{}", state.port)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderStatus {
    installed: bool,
    authenticated: bool,
}

fn executable_name(name: &str) -> OsString {
    if cfg!(windows) {
        OsString::from(format!("{name}.exe"))
    } else {
        OsString::from(name)
    }
}

fn find_binary(name: &str) -> Option<PathBuf> {
    let executable = executable_name(name);

    if let Some(path_value) = env::var_os("PATH") {
        for directory in env::split_paths(&path_value) {
            let candidate = directory.join(&executable);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    let user_directory = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE"));
    user_directory.and_then(|directory| {
        let directory = PathBuf::from(directory);
        [
            directory.join(".local/bin").join(&executable),
            directory.join(".npm-global/bin").join(&executable),
            directory.join(".cargo/bin").join(&executable),
        ]
        .into_iter()
        .find(|candidate| candidate.is_file())
    })
}

fn find_codex_binary() -> Option<PathBuf> {
    find_binary("codex")
}

fn find_gemini_binary() -> Option<PathBuf> {
    find_binary("gemini")
}

#[tauri::command]
async fn codex_login_status() -> ProviderStatus {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(binary) = find_codex_binary() else {
            return ProviderStatus {
                installed: false,
                authenticated: false,
            };
        };

        let authenticated = Command::new(binary)
            .args(["login", "status"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|status| status.success());

        ProviderStatus {
            installed: true,
            authenticated,
        }
    })
    .await
    .unwrap_or(ProviderStatus {
        installed: false,
        authenticated: false,
    })
}

fn has_gemini_credentials() -> bool {
    if env::var_os("GEMINI_API_KEY").is_some() || env::var_os("GOOGLE_API_KEY").is_some() {
        return true;
    }

    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .is_some_and(|directory| directory.join(".gemini/google_accounts.json").is_file())
}

#[tauri::command]
async fn gemini_login_status() -> ProviderStatus {
    ProviderStatus {
        installed: find_gemini_binary().is_some(),
        authenticated: has_gemini_credentials(),
    }
}

#[tauri::command]
async fn connect_codex() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let binary = find_codex_binary().ok_or_else(|| {
            "Codex CLI was not found. Install Codex, then restart IFROG.".to_string()
        })?;

        let status = Command::new(binary)
            .arg("login")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|error| format!("Could not start Codex login: {error}"))?;

        if status.success() {
            Ok(())
        } else {
            Err("Codex login was cancelled or did not complete.".to_string())
        }
    })
    .await
    .map_err(|error| format!("Codex login task failed: {error}"))?
}

#[tauri::command]
async fn connect_gemini() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let binary = find_gemini_binary().ok_or_else(|| {
            "Gemini CLI was not found. Install Gemini CLI, then restart IFROG.".to_string()
        })?;

        #[cfg(target_os = "linux")]
        let status = {
            let terminal = find_binary("x-terminal-emulator")
                .or_else(|| find_binary("xdg-terminal-exec"))
                .ok_or_else(|| "No system terminal was found for Gemini login.".to_string())?;
            Command::new(terminal)
                .arg("-e")
                .arg(binary)
                .status()
                .map_err(|error| format!("Could not open Gemini login: {error}"))?
        };

        #[cfg(target_os = "windows")]
        let status = Command::new("cmd")
            .args(["/C", "start", "", &binary.to_string_lossy()])
            .status()
            .map_err(|error| format!("Could not open Gemini login: {error}"))?;

        #[cfg(target_os = "macos")]
        let status = Command::new("open")
            .args(["-a", "Terminal", &binary.to_string_lossy()])
            .status()
            .map_err(|error| format!("Could not open Gemini login: {error}"))?;

        if status.success() {
            Ok(())
        } else {
            Err("Gemini login was cancelled or did not complete.".to_string())
        }
    })
    .await
    .map_err(|error| format!("Gemini login task failed: {error}"))?
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentRequest {
    provider: String,
    prompt: String,
    working_directory: Option<String>,
}

#[derive(serde::Serialize)]
struct AgentResponse {
    content: String,
}

fn agent_working_directory(requested: Option<String>) -> Result<PathBuf, String> {
    let directory = match requested {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => env::current_dir().map_err(|error| format!("Could not resolve workspace: {error}"))?,
    };

    if !directory.is_dir() {
        return Err("The selected repository directory is not available.".to_string());
    }

    Ok(directory)
}

fn command_failure(provider: &str, stderr: &[u8]) -> String {
    let details = String::from_utf8_lossy(stderr);
    let details = details.trim();
    if details.is_empty() {
        return format!("{provider} did not return a response.");
    }

    let short_details: String = details.chars().take(2_000).collect();
    format!("{provider} failed: {short_details}")
}

#[tauri::command]
async fn run_agent(request: AgentRequest) -> Result<AgentResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let prompt = request.prompt.trim();
        if prompt.is_empty() {
            return Err("Enter a message for the agent.".to_string());
        }
        if prompt.len() > 64_000 {
            return Err("The message is too long. Keep it under 64,000 characters.".to_string());
        }

        let directory = agent_working_directory(request.working_directory)?;
        let output = match request.provider.as_str() {
            "codex" => {
                let binary = find_codex_binary().ok_or_else(|| {
                    "Codex CLI was not found. Connect or install Codex first.".to_string()
                })?;
                Command::new(binary)
                    .args([
                        "exec",
                        "--ephemeral",
                        "--sandbox",
                        "read-only",
                        "--color",
                        "never",
                        "--skip-git-repo-check",
                        "--",
                    ])
                    .arg(prompt)
                    .current_dir(directory)
                    .stdin(Stdio::null())
                    .output()
                    .map_err(|error| format!("Could not run Codex: {error}"))?
            }
            "gemini" => {
                let binary = find_gemini_binary().ok_or_else(|| {
                    "Gemini CLI was not found. Connect or install Gemini first.".to_string()
                })?;
                Command::new(binary)
                    .args([
                        "--prompt",
                        prompt,
                        "--output-format",
                        "text",
                        "--approval-mode",
                        "plan",
                    ])
                    .current_dir(directory)
                    .stdin(Stdio::null())
                    .output()
                    .map_err(|error| format!("Could not run Gemini: {error}"))?
            }
            _ => return Err("Choose Codex or Gemini before sending a message.".to_string()),
        };

        let provider_name = if request.provider == "codex" {
            "Codex"
        } else {
            "Gemini"
        };
        if !output.status.success() {
            return Err(command_failure(provider_name, &output.stderr));
        }

        let content = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if content.is_empty() {
            return Err(format!("{provider_name} returned an empty response."));
        }

        Ok(AgentResponse { content })
    })
    .await
    .map_err(|error| format!("Agent task failed: {error}"))?
}

fn available_port() -> Result<u16, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let port = available_port()?;
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let database_path = data_dir.join("devpilot.db");

            let sidecar = app
                .shell()
                .sidecar("devpilot-backend")?
                .env("DEVPILOT_PORT", port.to_string())
                .env("DEVPILOT_DATABASE_PATH", database_path);
            let (mut events, child) = sidecar.spawn()?;

            tauri::async_runtime::spawn(async move {
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Error(error) => eprintln!("[backend] {error}"),
                        CommandEvent::Terminated(status) => {
                            eprintln!("[backend] exited with code {:?}", status.code);
                        }
                        _ => {}
                    }
                }
            });

            app.manage(BackendState {
                port,
                child: Mutex::new(Some(child)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_url,
            codex_login_status,
            gemini_login_status,
            connect_codex,
            connect_gemini,
            run_agent
        ])
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                let state = window.state::<BackendState>();
                let child = state.child.lock().expect("backend state lock").take();
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running IFROG");
}
