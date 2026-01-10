import React from 'react';

interface DashboardCardProps {
  title: string;
  count: number | string;
  icon: React.ReactNode;
  colorClass: string; // Used for background in some styles or accent
  textColorClass?: string;
  iconColorClass?: string;
  onClick?: () => void;
  subText?: string;
  action?: React.ReactNode;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  count, 
  icon, 
  colorClass, 
  textColorClass = 'text-white',
  iconColorClass,
  onClick, 
  subText,
  action 
}) => {
  // Check if colorClass is a bg-white or light color to adjust defaults if needed, 
  // but we mostly rely on passed props now for the theme.
  
  return (
    <div 
      onClick={onClick}
      className={`relative p-5 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center space-y-3 transition-transform active:scale-95 border border-transparent ${colorClass} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`p-3 rounded-full ${iconColorClass ? 'bg-white/10' : 'bg-white/20'} ${iconColorClass || 'text-white'}`}>
        {icon}
      </div>
      <h3 className={`${textColorClass} text-sm font-medium opacity-80`}>{title}</h3>
      <div className={`text-3xl font-bold ${textColorClass}`}>
        {count}
      </div>
      {subText && <span className={`text-xs ${textColorClass} opacity-60`}>{subText}</span>}
      {action && <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>{action}</div>}
    </div>
  );
};