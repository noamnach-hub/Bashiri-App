import React from 'react';
import { FireberryInquiry } from '../types';
import { ChevronLeft, Calendar } from 'lucide-react';

import { formatPhoneNumber } from '../utils';

interface LeadCardProps {
  lead: FireberryInquiry;
  onClick: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 transition-colors"
    >
      <div className="flex-1">
        <h4 className="font-bold text-lg text-[#111111]">{lead.name}</h4>
        <div className="flex items-center text-sm text-gray-500 mt-1 space-x-2 space-x-reverse">
          <span className="bg-[#111111] text-[#A2D294] text-[10px] font-bold px-2 py-0.5 rounded">
            {lead.statuscode || 'פנייה חדשה'}
          </span>
          <span className="text-gray-600 font-mono tracking-wide">{formatPhoneNumber(lead.phone)}</span>
        </div>

        <div className="mt-2 flex items-center text-xs text-gray-400">
          <Calendar size={12} className="ml-1 text-[#A2D294]" />
          {new Date(lead.createdon).toLocaleDateString('he-IL')}
          <span className="mx-1">|</span>
          <span className="line-clamp-1">{lead.description || 'אין הערות'}</span>
        </div>
      </div>
      <div className="mr-4 text-[#A2D294]">
        <ChevronLeft size={24} />
      </div>
    </div>
  );
};