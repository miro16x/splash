You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
m-variable-font-hover-1.tsx
"use client";
import { VariableFontHover } from "@/components/ui/variable-font-hover";

const navLinks = ["Products", "Solutions", "Pricing", "Company", "Blog"];

export default function VariableFontHoverNav() {
  return (
    <nav className="flex min-h-50 flex-wrap items-center justify-center gap-8 px-6">
      {navLinks.map((link) => (
        <VariableFontHover
          className="cursor-pointer text-base text-muted-foreground transition-colors hover:text-foreground"
          fromFontVariationSettings="'wght' 400"
          key={link}
          label={link}
          staggerDuration={0.03}
          staggerFrom="center"
          toFontVariationSettings="'wght' 700"
        />
      ))}
    </nav>
  );
}

demo.tsx
import VariableFontHoverNav from "@/components/ui/m-variable-font-hover-1";

export default function Default() {
  return <VariableFontHoverNav />;
}

```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them
