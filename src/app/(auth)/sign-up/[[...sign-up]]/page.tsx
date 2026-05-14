import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
      <SignUp appearance={{ elements: { formButtonPrimary: "bg-[#A67B5B] hover:bg-[#8C664A]", card: "bg-[#1A1A1A] border-[#2A2A2A]", headerTitle: "text-white", headerSubtitle: "text-[#888]", formFieldLabel: "text-white", formFieldInput: "bg-[#0A0A0A] border-[#2A2A2A] text-white", footerActionText: "text-[#888]", footerActionLink: "text-[#A67B5B] hover:text-[#8C664A]" } }} />
    </div>
  );
}