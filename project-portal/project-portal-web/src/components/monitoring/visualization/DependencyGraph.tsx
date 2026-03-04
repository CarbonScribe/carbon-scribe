'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ReactFlow, Controls, Background, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '@/lib/store/store';
import ServiceNode from './ServiceNode';
import NodeDetailPanel from './NodeDetailPanel';
import GraphControls from './GraphControls';

const nodeTypes = { service: ServiceNode };

export default function DependencyGraph() {
    const services = useStore(state => state.services);
    const deps = useStore(state => state.dependencies);
    const isLoading = useStore(state => state.healthLoading.isFetchingDependencies);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Auto-layout in a simple grid
    const initialNodes: Node[] = React.useMemo(() => {
        return services.map((s, i) => ({
            id: s.serviceId,
            type: 'service',
            position: { x: (i % 3) * 250 + 50, y: Math.floor(i / 3) * 150 + 50 },
            data: { label: s.serviceName, status: s.status }
        }));
    }, [services]);

    const initialEdges: Edge[] = React.useMemo(() => {
        return deps.map((d) => {
            const isHealthy = d.status === 'Healthy';
            return {
                id: `e-${d.sourceId}-${d.targetId}`,
                source: d.sourceId,
                target: d.targetId,
                animated: !isHealthy,
                style: { stroke: isHealthy ? '#9CA3AF' : d.status === 'Degraded' ? '#F59E0B' : '#EF4444', strokeWidth: 2 }
            };
        });
    }, [deps]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync nodes when services update
    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    if (isLoading) {
        return <div className="h-[500px] bg-gray-50 flex items-center justify-center animate-pulse border border-gray-200 rounded-lg text-gray-500">Loading dependency graph...</div>;
    }

    if (services.length === 0) {
        return <div className="h-[500px] border border-dashed rounded-lg flex items-center justify-center text-gray-500">No dependencies to map.</div>;
    }

    return (
        <div className="h-[600px] w-full border border-gray-200 rounded-lg bg-gray-50 relative flex overflow-hidden lg:h-[700px]">
            <div className="flex-1 h-full relative">
                <GraphControls />
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => setSelectedNodeId(null)}
                    fitView
                    minZoom={0.2}
                    maxZoom={1.5}
                    attributionPosition="bottom-left"
                >
                    <Background color="#ccc" gap={20} size={1} />
                    <Controls />
                </ReactFlow>
            </div>

            {/* Side Panel Overlay */}
            {selectedNodeId && (
                <NodeDetailPanel
                    service={services.find(s => s.serviceId === selectedNodeId)}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}
        </div>
    );
}
