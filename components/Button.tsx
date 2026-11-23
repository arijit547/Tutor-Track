import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', icon, ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b5d49]/45 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.99]';
  const variants = {
    primary: 'bg-[#285944] text-white hover:bg-[#1d4936]',
    secondary: 'bg-white text-[#345743] border border-[#d9e1d7] hover:bg-[#f6f8f4] hover:border-[#b8cabd]',
    danger: 'bg-[#fdf4f1] text-[#9e4b3d] border border-[#f0d7d0] hover:bg-[#fce9e4]',
    ghost: 'text-[#596a5e] hover:bg-[#eff3ed] hover:text-[#274c37]',
    outline: 'bg-white text-[#345743] border border-[#aec4b5] hover:bg-[#f5f8f3]',
  };
  const sizes = { sm: 'px-3 py-2 text-xs min-h-9', md: 'px-4 py-2.5 text-sm min-h-10', lg: 'px-5 py-3 text-sm min-h-12' };
  return <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{icon && <span className="shrink-0">{icon}</span>}{children}</button>;
};
