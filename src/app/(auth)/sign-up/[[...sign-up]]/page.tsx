import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-[size:20px_20px] font-mono relative overflow-hidden">
      {/* Scanline effect */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20"></div>
      
      <SignUp appearance={{ 
        elements: { 
          formButtonPrimary: "bg-[#00FF41] hover:bg-[#00CC33] text-black font-bold font-mono uppercase tracking-widest rounded-none border-none transition-colors", 
          card: "bg-black border border-[#00FF41]/50 rounded-none shadow-[0_0_20px_rgba(0,255,65,0.15)] font-mono p-8 relative z-20", 
          headerTitle: "text-[#00FF41] font-mono uppercase tracking-wider text-xl", 
          headerSubtitle: "text-[#00FF41]/70 font-mono text-sm", 
          formFieldLabel: "text-[#00FF41] font-mono uppercase text-xs tracking-wider", 
          formFieldInput: "bg-black border border-[#00FF41]/30 text-[#00FF41] font-mono rounded-none focus:ring-1 focus:ring-[#00FF41] focus:border-[#00FF41] transition-colors", 
          footerActionText: "text-[#00FF41]/70 font-mono text-sm", 
          footerActionLink: "text-[#00FF41] hover:text-[#00CC33] hover:underline font-mono text-sm transition-colors",
          identityPreviewText: "text-[#00FF41] font-mono",
          identityPreviewEditButton: "text-[#00FF41]/70 hover:text-[#00FF41] font-mono",
          dividerLine: "bg-[#00FF41]/20",
          dividerText: "text-[#00FF41]/50 font-mono text-xs",
          socialButtonsBlockButton: "border border-[#00FF41]/30 text-[#00FF41] font-mono rounded-none hover:bg-[#00FF41]/10 transition-colors bg-black",
          socialButtonsBlockButtonText: "text-[#00FF41] font-mono font-normal",
          formFieldSuccessText: "text-[#00FF41] font-mono",
          formFieldErrorText: "text-red-500 font-mono",
          logoImage: "filter invert sepia hue-rotate-[80deg] saturate-[500%] brightness-[100%]"
        },
        layout: {
          socialButtonsPlacement: 'bottom',
          showOptionalFields: false,
        }
      }} />
    </div>
  );
}
