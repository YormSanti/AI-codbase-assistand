import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

function Asker({ title = "Delete everything?" }: { title?: string }) {
  const confirm = useConfirm();
  const [answer, setAnswer] = useState("none");
  return <>
    <button type="button" onClick={() => void confirm({ title, description: "This cannot be undone.", confirmLabel: "Delete", destructive: true }).then(ok => setAnswer(String(ok)))}>Ask</button>
    <output aria-label="Answer">{answer}</output>
  </>;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ConfirmProvider", () => {
  it("resolves true when confirmed and false when canceled or dismissed", async () => {
    render(<ConfirmProvider><Asker /></ConfirmProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete everything?" });
    expect(dialog).toHaveTextContent("This cannot be undone.");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByLabelText("Answer")).toHaveTextContent("true"));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByLabelText("Answer")).toHaveTextContent("false"));

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.keyDown(await screen.findByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByLabelText("Answer")).toHaveTextContent("false");
  });

  it("falls back to the native prompt outside a provider", async () => {
    const native = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Asker title="Proceed?" />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.getByLabelText("Answer")).toHaveTextContent("true"));
    expect(native).toHaveBeenCalledWith("Proceed?\n\nThis cannot be undone.");
  });
});
