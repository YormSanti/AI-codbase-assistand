"use client";

import { useState } from 'react';

export default function DownloadButton() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('https://api.github.com/repos/YormSanti/AI-codbase-assistand/releases/latest');
      if (!response.ok) throw new Error('Failed to fetch release');
      
      const data = await response.json();
      
      const debAsset = data.assets?.find((asset: any) => asset.name.endsWith('.deb'));
      const appImageAsset = data.assets?.find((asset: any) => asset.name.endsWith('.AppImage'));
      
      const downloadUrl = debAsset?.browser_download_url || appImageAsset?.browser_download_url;

      if (downloadUrl) {
        window.location.href = downloadUrl;
      } else {
        window.open('https://github.com/YormSanti/AI-codbase-assistand/releases/latest', '_blank');
      }
    } catch (error) {
      console.error('Error fetching release:', error);
      window.open('https://github.com/YormSanti/AI-codbase-assistand/releases/latest', '_blank');
    } finally {
      setLoading(false);
    }
  };

  return (
    <a href="https://github.com/YormSanti/AI-codbase-assistand/releases/latest" 
       onClick={handleDownload}
       className="flex items-center justify-center gap-3 px-8 py-4 bg-emerald-400 hover:bg-emerald-300 text-black font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] transform hover:-translate-y-1">
      {loading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg viewBox="0 0 448 512" fill="currentColor" className="w-5 h-5">
          <path d="M220.8 123.3c1 .5 1.8 1.7 3 1.7 1.1 0 2.8-.4 2.9-1.5.2-1.4-1.9-2.3-3.2-2.9-1.7-.7-3.9-1-5.5-.1-.4.2-.8.7-.6 1.1.3 1.3 2.3 1.1 3.4 1.7zm-21.9 1.7c1.2 0 2-1.2 3-1.7 1.1-.6 3.1-.4 3.5-1.7.2-.4-.2-.9-.6-1.1-1.6-.9-3.8-.6-5.5.1-1.3.6-3.4 1.5-3.2 2.9.1 1 1.8 1.5 2.8 1.5zM440 254.3c-2.8-66-53.2-127.6-118-144.4-6.3-1.6-13-2.7-19.6-3.8l.2-.9c1.9-9.2-2.3-18.7-10.7-22.9-10.5-5.3-23.7-.8-28.7 9.8-1.7 3.5-2 7.4-1.4 11l-.8.1c-11.7-1.3-23.6-2.1-35.6-2.1-12 0-24 .8-35.6 2.1l-.8-.1c.6-3.6.3-7.5-1.4-11-5-10.6-18.1-15.1-28.7-9.8-8.4 4.2-12.6 13.7-10.7 22.9l.2.9c-6.6 1-13.3 2.1-19.6 3.8C65.5 126.7 12 188.4 9.2 254.3c-3 70.3 33.6 148.6 96.6 182.2 6.5 3.5 14 5.3 21.6 5.3h193.3c7.5 0 15-1.8 21.6-5.3 63-33.6 99.6-111.9 96.6-182.2zm-282.8 61.1c-4.4 3.7-10.6 4.3-16 1.7-7-3.3-8.8-11.8-4.2-17.6 4.6-5.8 12.8-7.5 19.3-3.9 6.2 3.5 7.6 11.5 3.3 16.5 0 0-1.2 1.9-2.4 3.3zm67.1 27.6c-20 6.1-42.3 6.1-62.3 0-5.8-1.8-11.7-6.9-9-13.1 2.3-5.3 10-5.4 14.8-4.3 16.9 4 34.9 4 51.8 0 4.8-1.1 12.5-1 14.8 4.3 2.7 6.2-3.1 11.3-9 13.1zm41.6-27.6c-1.2-1.4-2.4-3.3-2.4-3.3-4.3-5-2.9-13 3.3-16.5 6.5-3.6 14.7-1.9 19.3 3.9 4.6 5.8 2.8 14.3-4.2 17.6-5.4 2.6-11.6 2-16-1.7z"/>
        </svg>
      )}
      {loading ? 'Starting Download...' : 'Download for Linux'}
    </a>
  );
}
