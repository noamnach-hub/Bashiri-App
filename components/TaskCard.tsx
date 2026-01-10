import React from 'react';
import { FireberryTask } from '../types';
import { Phone, Calendar } from 'lucide-react';

interface TaskCardProps {
  task: FireberryTask;
  onCall: (task: FireberryTask) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onCall }) => {
  const isOverdue = new Date(task.scheduledend) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-l-[#A2D294] flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center space-x-2 space-x-reverse mb-1">
          <h4 className="font-bold text-[#111111]">{task.regardingobjectidname || 'לקוח ללא שם'}</h4>
          {isOverdue && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">באיחור</span>}
        </div>
        <p className="text-sm text-gray-600 mb-2 pl-2">{task.subject}</p>
        <div className="flex items-center text-xs text-gray-400">
          <Calendar size={12} className="ml-1 text-[#A2D294]" />
          {new Date(task.scheduledend).toLocaleDateString('he-IL')}
          <span className="mx-2">|</span>
          <a
            href={`https://app.powerlink.co.il/Record/Details/4212/${task.activityid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#A2D294] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            צפה בפיירברי
          </a>
        </div>
      </div>

      <a
        href={`tel:0500000000`}
        onClick={() => onCall(task)}
        className="bg-[#111111] hover:bg-black text-[#A2D294] p-3 rounded-xl shadow-md active:scale-95 transition-transform"
      >
        <Phone size={20} />
      </a>
    </div>
  );
};