export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html { scroll-behavior: smooth; }
          body {
            background: #03050f;
            color: rgba(210,225,245,0.9);
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
          }
          ::selection { background: rgba(0,212,255,0.25); color: #00ffff; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: #03050f; }
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg,#00d4ff,#a855f7,#f43f5e);
            border-radius: 99px;
          }

          /* Aurora blobs */
          @keyframes aurora1 {
            0%,100% { transform: translate(0,0) scale(1) rotate(0deg); }
            25%     { transform: translate(100px,-80px) scale(1.2) rotate(10deg); }
            50%     { transform: translate(-60px,100px) scale(0.85) rotate(-8deg); }
            75%     { transform: translate(80px,50px) scale(1.1) rotate(5deg); }
          }
          @keyframes aurora2 {
            0%,100% { transform: translate(0,0) scale(1); }
            33%     { transform: translate(-110px,60px) scale(1.25); }
            66%     { transform: translate(80px,-100px) scale(0.8); }
          }
          @keyframes aurora3 {
            0%,100% { transform: translate(0,0) scale(1); }
            40%     { transform: translate(90px,90px) scale(1.35); }
            80%     { transform: translate(-70px,-50px) scale(0.75); }
          }
          @keyframes aurora4 {
            0%,100% { transform: translate(0,0) scale(1) rotate(0deg); }
            50%     { transform: translate(-60px,60px) scale(1.4) rotate(15deg); }
          }

          /* Grid drift */
          @keyframes gridDrift {
            from { background-position: 0 0; }
            to   { background-position: 48px 48px; }
          }

          /* Scanlines */
          @keyframes scan1 {
            0%   { top: -4px; opacity: 0; }
            4%   { opacity: 1; }
            96%  { opacity: 0.8; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes scan2 {
            0%   { top: -4px; opacity: 0; }
            4%   { opacity: 0.7; }
            96%  { opacity: 0.5; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes scan3 {
            0%   { top: -4px; opacity: 0; }
            4%   { opacity: 0.5; }
            96%  { opacity: 0.3; }
            100% { top: 100%; opacity: 0; }
          }

          /* Laser corner flares */
          @keyframes flare {
            0%,100% { opacity: 0.5; transform: scale(1); }
            50%     { opacity: 1; transform: scale(1.3); }
          }

          /* Horizontal laser streaks */
          @keyframes laserH {
            0%   { left: -100%; opacity: 0; }
            5%   { opacity: 1; }
            95%  { opacity: 0.6; }
            100% { left: 100%; opacity: 0; }
          }
          @keyframes laserV {
            0%   { top: -100%; opacity: 0; }
            5%   { opacity: 0.8; }
            95%  { opacity: 0.4; }
            100% { top: 100%; opacity: 0; }
          }

          /* Pulse glow on vignette */
          @keyframes vignettePulse {
            0%,100% { opacity: 0.75; }
            50%     { opacity: 0.9; }
          }
        `}</style>
      </head>
      <body>
        <div style={{ position:"fixed", inset:0, zIndex:0, overflow:"hidden", pointerEvents:"none" }}>

          {/* Deep base gradient */}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#03050f 0%,#06080f 30%,#08041a 60%,#030a10 100%)" }} />

          {/* Aurora blob 1 — electric cyan */}
          <div style={{ position:"absolute", top:"-25%", left:"-20%", width:800, height:800, borderRadius:"50%", background:"radial-gradient(circle,rgba(0,220,255,0.32) 0%,rgba(0,180,255,0.12) 40%,transparent 70%)", filter:"blur(55px)", animation:"aurora1 18s ease-in-out infinite" }} />

          {/* Aurora blob 2 — violet */}
          <div style={{ position:"absolute", top:"5%", right:"-25%", width:900, height:900, borderRadius:"50%", background:"radial-gradient(circle,rgba(180,0,255,0.28) 0%,rgba(140,0,200,0.1) 45%,transparent 70%)", filter:"blur(65px)", animation:"aurora2 22s ease-in-out infinite" }} />

          {/* Aurora blob 3 — neon green */}
          <div style={{ position:"absolute", bottom:"-25%", left:"20%", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle,rgba(0,255,160,0.22) 0%,rgba(0,200,120,0.08) 45%,transparent 70%)", filter:"blur(50px)", animation:"aurora3 16s ease-in-out infinite" }} />

          {/* Aurora blob 4 — hot pink/magenta */}
          <div style={{ position:"absolute", bottom:"5%", right:"5%", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,0,128,0.25) 0%,rgba(200,0,100,0.08) 45%,transparent 70%)", filter:"blur(45px)", animation:"aurora4 13s ease-in-out infinite reverse" }} />

          {/* Aurora blob 5 — orange accent center */}
          <div style={{ position:"absolute", top:"40%", left:"40%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,140,0,0.15) 0%,transparent 65%)", filter:"blur(60px)", animation:"aurora1 25s ease-in-out infinite reverse" }} />

          {/* Sharp laser grid */}
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(0,220,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,220,255,0.07) 1px,transparent 1px),linear-gradient(rgba(168,85,247,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.04) 1px,transparent 1px)", backgroundSize:"48px 48px, 48px 48px, 192px 192px, 192px 192px", animation:"gridDrift 8s linear infinite" }} />

          {/* Scanline 1 — cyan fast */}
          <div style={{ position:"absolute", left:0, right:0, height:3, background:"linear-gradient(90deg,transparent 0%,rgba(0,220,255,0.7) 20%,rgba(0,255,255,1) 50%,rgba(0,220,255,0.7) 80%,transparent 100%)", boxShadow:"0 0 8px 2px rgba(0,220,255,0.6), 0 0 20px 4px rgba(0,220,255,0.25)", animation:"scan1 5s linear infinite" }} />

          {/* Scanline 2 — purple slower */}
          <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent 0%,rgba(200,0,255,0.5) 30%,rgba(220,100,255,0.9) 50%,rgba(200,0,255,0.5) 70%,transparent 100%)", boxShadow:"0 0 6px 2px rgba(200,0,255,0.4)", animation:"scan2 8s linear infinite 2s" }} />

          {/* Scanline 3 — pink slowest */}
          <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent 0%,rgba(255,0,128,0.4) 30%,rgba(255,80,160,0.8) 50%,rgba(255,0,128,0.4) 70%,transparent 100%)", boxShadow:"0 0 6px 2px rgba(255,0,128,0.3)", animation:"scan3 11s linear infinite 5s" }} />

          {/* Horizontal laser streak — cyan */}
          <div style={{ position:"absolute", top:"30%", width:"60%", height:1, background:"linear-gradient(90deg,transparent,rgba(0,255,255,0.9),transparent)", boxShadow:"0 0 12px 2px rgba(0,255,255,0.5)", animation:"laserH 9s linear infinite 1s" }} />

          {/* Horizontal laser streak — magenta */}
          <div style={{ position:"absolute", top:"65%", width:"45%", height:1, background:"linear-gradient(90deg,transparent,rgba(255,0,200,0.8),transparent)", boxShadow:"0 0 10px 2px rgba(255,0,200,0.4)", animation:"laserH 13s linear infinite 4s" }} />

          {/* Corner flares */}
          <div style={{ position:"absolute", top:0, left:0, width:220, height:220, background:"radial-gradient(circle at top left, rgba(0,220,255,0.25) 0%, transparent 65%)", animation:"flare 4s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:0, right:0, width:180, height:180, background:"radial-gradient(circle at top right, rgba(200,0,255,0.2) 0%, transparent 65%)", animation:"flare 5s ease-in-out infinite 1s" }} />
          <div style={{ position:"absolute", bottom:0, left:0, width:160, height:160, background:"radial-gradient(circle at bottom left, rgba(0,255,160,0.18) 0%, transparent 65%)", animation:"flare 6s ease-in-out infinite 2s" }} />
          <div style={{ position:"absolute", bottom:0, right:0, width:200, height:200, background:"radial-gradient(circle at bottom right, rgba(255,0,128,0.2) 0%, transparent 65%)", animation:"flare 4.5s ease-in-out infinite 0.5s" }} />

          {/* Deep vignette */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 50%,transparent 15%,rgba(2,4,12,0.85) 100%)", animation:"vignettePulse 6s ease-in-out infinite" }} />
        </div>

        <div style={{ position:"relative", zIndex:1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}