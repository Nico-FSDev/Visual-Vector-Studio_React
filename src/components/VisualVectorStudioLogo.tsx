import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'primary' | 'monochrome' | 'dark' | 'light' | 'simplified';
}

export function VisualVectorStudioLogo({ className = "w-10 h-10", variant = 'primary' }: LogoProps) {
  const isMonochrome = variant === 'monochrome';
  
  return (
    <img 
      src="/icon.png" 
      alt="Visual Vector Studio Logo" 
      className={`${className} ${isMonochrome ? 'grayscale opacity-70' : ''}`}
    />
  );
}
