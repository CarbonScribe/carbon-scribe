'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';

export default function ServiceNode({ data }: NodeProps) {
    const label = data.label as string;
    const status = data.status as string;

    let Icon = MinusCircle;
    let colorClass = 'text-gray-500 bg-gray-50 border-gray-200';
    let iconColor = 'text-gray-500';

    if (status === 'Healthy') {
        Icon = CheckCircle2;
        colorClass = 'bg-white border-green-300';
        iconColor = 'text-green-500';
    } else if (status === 'Degraded') {
        Icon = AlertTriangle;
        colorClass = 'bg-yellow-50 border-yellow-300';
        iconColor = 'text-yellow-600';
    } else if (status === 'Unhealthy') {
        Icon = XCircle;
        colorClass = 'bg-red-50 border-red-300';
        iconColor = 'text-red-600';
    }

    return (
        <div className={`px-4 py-2 shadow-sm rounded-md border-2 flex items-center gap-3 w-48 ${colorClass}`}>
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" />
            <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
            <div className="font-semibold text-sm text-gray-800 truncate" title={label}>{label}</div>
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" />
        </div>
    );
}
