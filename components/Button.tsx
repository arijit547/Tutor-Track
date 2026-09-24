import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5b57a6]/15 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[.98]';

  const variants = {
    primary: 'bg-[#34326f] text-white shadow-[0_8px_20px_rgba(52,50,111,.18)] hover:bg-[#29275d] hover:-translate-y-0.5',
    secondary: 'bg-white text-[#34324b] border border-[#dedbe3] shadow-sm hover:border-[#c9c4d6] hover:bg-[#fbfaf7]',
    danger: 'bg-[#fff4f1] text-[#b84b3f] border border-[#f3d3ce] hover:bg-[#ffeae6]',
    ghost: 'text-[#6f6d7e] hover:bg-[#efedf4] hover:text-[#302f4a]',
    outline: 'border border-[#8c88bb] text-[#4b487f] bg-white hover:bg-[#f4f2fa] hover:border-[#6965a6]',
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-xs min-h-9',
    md: 'px-[18px] py-2.5 text-sm min-h-10',
    lg: 'px-[22px] py-3 text-sm min-h-12',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
