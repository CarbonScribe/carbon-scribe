'use client';

import React from 'react';
import { Search } from 'lucide-react';

export default function GraphControls() {
    return (
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
                type="text"
                placeholder="Find node..."
                className="text-sm outline-none border-none bg-transparent w-40 placeholder-gray-400"
            />
        </div>
    );
}
