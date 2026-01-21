import React from 'react';

export const Loading = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    {/* Spinner with glow */}
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
      <div
        className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-transparent border-t-[#A2D294] animate-spin"
        style={{ animationDuration: '0.8s' }}
      ></div>
      {/* Glow effect */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#A2D294]/20 blur-md animate-pulse"
      ></div>
    </div>
    {/* Loading text */}
    <p className="text-gray-400 text-sm font-medium animate-pulse">טוען נתונים...</p>
  </div>
);