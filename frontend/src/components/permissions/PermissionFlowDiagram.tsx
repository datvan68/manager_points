'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Route, FolderKanban, ShieldCheck } from 'lucide-react';

// ---------------------------------------------------------
// CUSTOM NODES
// ---------------------------------------------------------

const RouteNode = ({ data }: any) => {
  const checkTypeLabel = data.check_type === 'all' ? 'Yêu cầu tất cả' : 'Yêu cầu ít nhất 1';
  const typeLabel = data.type === 'api' ? 'API' : data.type === 'feature' ? 'Chức năng' : 'Trang';
  const isActive = data.is_active !== false;

  return (
    <div className={`px-4 py-3 shadow-lg rounded-xl bg-white border-2 min-w-[260px] flex flex-col gap-2 transition-all cursor-pointer ${
      data.selected ? 'border-blue-650 ring-2 ring-blue-500/20' : (isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-60')
    } ${data.dimmed ? 'opacity-30' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
        }`}>
          <Route size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono font-bold text-indigo-500 truncate mb-0.5" title={data.path}>{data.path}</div>
          <div className="text-sm font-bold text-slate-800 truncate" title={data.label}>{data.label}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap border-t border-slate-100 pt-2 text-[9px] font-bold">
        <span className={`px-1.5 py-0.5 rounded text-white ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}>
          {isActive ? 'Hoạt động' : 'Tắt'}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
          {typeLabel}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">
          {checkTypeLabel} ({data.requiredCount})
        </span>
        {data.hasUnmapped && (
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
            ⚠️ Lỗi map
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-indigo-500 border-2 border-white" />
    </div>
  );
};

const RouteAccessHubNode = ({ data }: any) => {
  return (
    <div className={`px-3 py-1.5 shadow-sm rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-750 min-w-[180px] flex items-center justify-center gap-2 transition-all ${data.dimmed ? 'opacity-30' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-1.5 h-1.5 bg-indigo-400 border border-white" />
      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Quyền vào trang</span>
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 bg-indigo-400 border border-white" />
    </div>
  );
};

const PageActionHubNode = ({ data }: any) => {
  return (
    <div className={`px-3 py-1.5 shadow-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-750 min-w-[180px] flex items-center justify-center gap-2 transition-all ${data.dimmed ? 'opacity-30' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-1.5 h-1.5 bg-amber-400 border border-white" />
      <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Quyền thao tác</span>
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 bg-amber-400 border border-white" />
    </div>
  );
};

const PermissionChildNode = ({ data }: any) => {
  const isMissing = data.status === 'missing';
  const isUnmapped = data.status === 'unmapped';
  const isProposed = data.status === 'proposed';
  const isError = isMissing || isUnmapped;

  return (
    <div className={`px-3 py-2.5 shadow-md rounded-xl border-2 transition-all min-w-[240px] bg-white flex flex-col gap-1.5 cursor-pointer ${
      data.selected 
        ? 'border-blue-650 ring-2 ring-blue-500/20' 
        : (isError 
            ? 'border-rose-350' 
            : isProposed 
              ? 'border-dashed border-slate-300 hover:border-slate-400 bg-slate-50' 
              : 'border-slate-200 hover:border-slate-350')
    } ${data.dimmed ? 'opacity-30' : ''}`}>
      <Handle type="target" position={Position.Left} className={`w-2 h-2 border-2 border-white ${isError ? 'bg-rose-500' : isProposed ? 'bg-slate-400' : 'bg-emerald-500'}`} />
      
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={16} className={`mt-0.5 shrink-0 ${isError ? 'text-rose-500' : isProposed ? 'text-slate-400' : 'text-emerald-500'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-slate-800 leading-tight truncate">{data.name}</div>
          <div className={`text-[10px] font-mono font-bold mt-0.5 ${isError ? 'text-rose-500' : isProposed ? 'text-slate-400' : 'text-slate-400'}`}>{data.code}</div>
        </div>
      </div>

      {data.groupName && (
        <div className="text-[9px] font-bold text-slate-400 border-t border-slate-100 pt-1.5 truncate">
          Nhóm: {data.groupName}
        </div>
      )}

      {isError && (
        <div className="text-[9px] font-black text-rose-500 mt-0.5 animate-pulse">
          {isMissing ? '⚠️ Quyền chưa định nghĩa!' : '⚠️ Chưa phân nhóm quyền'}
        </div>
      )}
      {isProposed && (
        <div className="text-[9px] font-black text-amber-600 mt-0.5">
          ℹ️ Quyền đề xuất bổ sung (Chưa có Guard)
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  routeNode: RouteNode,
  routeAccessHubNode: RouteAccessHubNode,
  pageActionHubNode: PageActionHubNode,
  permissionChildNode: PermissionChildNode,
};

// ---------------------------------------------------------
// AUTO LAYOUT & LOGIC
// ---------------------------------------------------------

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR', useSavedLayout = true) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 40 });

  let storedPositions: Record<string, { x: number; y: number }> = {};
  if (useSavedLayout && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('perm_flow_layout');
      if (saved) {
        storedPositions = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse layout from localStorage', e);
    }
  }

  nodes.forEach((node) => {
    let width = 200;
    let height = 70;
    if (node.type === 'routeNode') { width = 260; height = 90; }
    if (node.type === 'routeAccessHubNode') { width = 180; height = 45; }
    if (node.type === 'pageActionHubNode') { width = 180; height = 45; }
    if (node.type === 'permissionChildNode') { width = 240; height = 90; }
    
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    if (useSavedLayout && storedPositions[node.id]) {
      node.position = storedPositions[node.id];
    } else {
      node.position = {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      };
    }

    return node;
  });

  return { nodes, edges };
};


// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------

interface Props {
  routePermissions: any[];
  pagePermissionScopes: any[];
  groups: any[];
  permissionsByGroup: Record<string, any[]>;
}

export default function PermissionFlowDiagram({ routePermissions, pagePermissionScopes, groups, permissionsByGroup }: Props) {
  // States for filter and details
  const [searchQuery, setSearchQuery] = useState('');
  const [routeTypeFilter, setRouteTypeFilter] = useState('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState('all');
  const [permCodeSearch, setPermCodeSearch] = useState('');
  const [permTypeFilter, setPermTypeFilter] = useState('all'); // 'all' | 'route_access' | 'page_action'
  const [layoutTrigger, setLayoutTrigger] = useState(0);
  const [useSavedLayout, setUseSavedLayout] = useState(true);

  
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<any | null>(null);

  // Transform graph data with filter logic
  const { initialNodes, initialEdges, counters, allUniquePermissions } = useMemo(() => {
    if (!routePermissions || routePermissions.length === 0) {
      return { 
        initialNodes: [], 
        initialEdges: [], 
        counters: { totalRoutes: 0, totalRequiredPerms: 0, activeRoutesCount: 0, missingOrUnmappedCount: 0 }, 
        allUniquePermissions: [] 
      };
    }

    // 1. Map permission code -> groupId & metadata
    const permMetadataMap = new Map<string, { name: string; desc: string; groupName: string; status: 'mapped' | 'unmapped' | 'missing' | 'proposed' }>();

    Object.entries(permissionsByGroup).forEach(([groupId, perms]) => {
      const groupObj = groups.find(g => g.id === groupId);
      const isFallback = groupId === 'fallback_group' || groupId === 'fallback_group_unmapped';
      const isProposed = groupObj?.code === 'G_PROPOSED';
      const groupName = groupObj ? groupObj.name : (isFallback ? 'Chưa phân nhóm' : '');
      
      perms.forEach(p => {
        permMetadataMap.set(p.code, {
          name: p.name || p.code,
          desc: p.description || p.name || '',
          groupName,
          status: isProposed ? 'proposed' : (isFallback ? 'unmapped' : 'mapped')
        });
      });
    });

    const getPermMeta = (code: string) => {
      const meta = permMetadataMap.get(code);
      if (meta) return meta;
      return {
        name: code,
        desc: 'Quyền chưa được định nghĩa trong hệ thống (Missing)',
        groupName: 'Chưa phân nhóm',
        status: 'missing' as const
      };
    };

    // 2. Calculate global counters
    const totalRoutes = routePermissions.length;
    const activeRoutesCount = routePermissions.filter(r => r.is_active !== false).length;
    
    const allRequiredCodes = new Set<string>();
    routePermissions.forEach(r => {
      (r.permissions || []).forEach((p: any) => {
        allRequiredCodes.add(p.code || p);
      });
      const actionScope = pagePermissionScopes?.find(s => s.route_path === r.route_path);
      (actionScope?.action_permissions || []).forEach((code: string) => {
        allRequiredCodes.add(code);
      });
    });
    const totalRequiredPerms = allRequiredCodes.size;

    let missingOrUnmappedCount = 0;
    allRequiredCodes.forEach(code => {
      const meta = getPermMeta(code);
      if (meta.status === 'missing' || meta.status === 'unmapped') {
        missingOrUnmappedCount++;
      }
    });

    const counters = {
      totalRoutes,
      totalRequiredPerms,
      activeRoutesCount,
      missingOrUnmappedCount
    };

    // 3. Filter routes
    const filteredRoutes = routePermissions.filter(route => {
      const matchesSearch = 
        (route.route_path || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (route.route_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const routeType = route.type || 'page';
      const matchesType = routeTypeFilter === 'all' || routeType === routeTypeFilter;
      
      const isActive = route.is_active !== false;
      const matchesActive = 
        activeStatusFilter === 'all' || 
        (activeStatusFilter === 'active' && isActive) || 
        (activeStatusFilter === 'inactive' && !isActive);
      
      const routeAccessCodes = (route.permissions || []).map((p: any) => (p.code || p).toLowerCase());
      const actionScope = pagePermissionScopes?.find(s => s.route_path === route.route_path);
      const routeActionCodes = (actionScope?.action_permissions || []).map((code: string) => code.toLowerCase());
      
      let allRouteCodes: string[] = [];
      if (permTypeFilter === 'all') {
        allRouteCodes = [...routeAccessCodes, ...routeActionCodes];
      } else if (permTypeFilter === 'route_access') {
        allRouteCodes = routeAccessCodes;
      } else if (permTypeFilter === 'page_action') {
        allRouteCodes = routeActionCodes;
      }

      const matchesPermSearch = 
        !permCodeSearch || 
        allRouteCodes.some(code => code.includes(permCodeSearch.toLowerCase()));
      
      return matchesSearch && matchesType && matchesActive && matchesPermSearch;
    });

    // 4. Build graph elements
    const nodes: any[] = [];
    const edges: any[] = [];

    filteredRoutes.forEach(route => {
      const routeId = `route-${route._id || route.route_path}`;
      const routeAccessCodes = (route.permissions || []).map((p: any) => p.code || p);
      const actionScope = pagePermissionScopes?.find(s => s.route_path === route.route_path);
      const routeActionCodes = actionScope?.action_permissions || [];
      
      let routeHasUnmapped = false;

      const showAccess = permTypeFilter === 'all' || permTypeFilter === 'route_access';
      const showAction = permTypeFilter === 'all' || permTypeFilter === 'page_action';

      let displayCount = 0;
      if (showAccess) displayCount += routeAccessCodes.length;
      if (showAction) displayCount += routeActionCodes.length;

      // Add Route Node
      nodes.push({
        id: routeId,
        type: 'routeNode',
        data: {
          label: route.route_name,
          path: route.route_path,
          type: route.type,
          check_type: route.check_type,
          is_active: route.is_active,
          requiredCount: displayCount,
          hasUnmapped: false,
        },
        position: { x: 0, y: 0 },
      });

      // --- LỚP 1: QUYỀN VÀO TRANG (Access) ---
      const accessHubId = `route-access-hub-${routeId}`;
      if (showAccess && routeAccessCodes.length > 0) {
        nodes.push({
          id: accessHubId,
          type: 'routeAccessHubNode',
          data: { label: 'Quyền vào trang' },
          position: { x: 0, y: 0 },
        });

        // Edge Route -> AccessHub
        edges.push({
          id: `e-route-access-${routeId}`,
          source: routeId,
          target: accessHubId,
          type: 'smoothstep',
          animated: route.is_active !== false,
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        });

        // Add Access Permission Child Nodes
        routeAccessCodes.forEach(code => {
          const meta = getPermMeta(code);
          const childNodeId = `route-access-perm-${routeId}-${code}`;
          
          if (meta.status === 'missing' || meta.status === 'unmapped') {
            routeHasUnmapped = true;
          }

          nodes.push({
            id: childNodeId,
            type: 'permissionChildNode',
            data: {
              code,
              name: meta.name,
              desc: meta.desc,
              groupName: meta.groupName,
              status: meta.status,
              permissionType: 'route_access',
            },
            position: { x: 0, y: 0 },
          });

          // Edge AccessHub -> Child
          const isError = meta.status === 'missing' || meta.status === 'unmapped';
          edges.push({
            id: `e-access-hub-${childNodeId}`,
            source: accessHubId,
            target: childNodeId,
            type: 'smoothstep',
            animated: false,
            style: { 
              stroke: isError ? '#f43f5e' : '#10b981', 
              strokeWidth: 1.5 
            },
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: isError ? '#f43f5e' : '#10b981' 
            },
          });
        });
      }

      // --- LỚP 2: QUYỀN THAO TÁC TRONG TRANG (Actions) ---
      const actionHubId = `route-action-hub-${routeId}`;
      if (showAction && routeActionCodes.length > 0) {
        nodes.push({
          id: actionHubId,
          type: 'pageActionHubNode',
          data: { label: 'Quyền thao tác' },
          position: { x: 0, y: 0 },
        });

        // Edge Route -> ActionHub
        edges.push({
          id: `e-route-action-${routeId}`,
          source: routeId,
          target: actionHubId,
          type: 'smoothstep',
          animated: route.is_active !== false,
          style: { stroke: '#d97706', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#d97706' },
        });

        // Add Action Permission Child Nodes
        routeActionCodes.forEach(code => {
          const meta = getPermMeta(code);
          const childNodeId = `route-action-perm-${routeId}-${code}`;
          
          if (meta.status === 'missing' || meta.status === 'unmapped') {
            routeHasUnmapped = true;
          }

          nodes.push({
            id: childNodeId,
            type: 'permissionChildNode',
            data: {
              code,
              name: meta.name,
              desc: meta.desc,
              groupName: meta.groupName,
              status: meta.status,
              permissionType: 'page_action',
            },
            position: { x: 0, y: 0 },
          });

          // Edge ActionHub -> Child
          const isError = meta.status === 'missing' || meta.status === 'unmapped';
          edges.push({
            id: `e-action-hub-${childNodeId}`,
            source: actionHubId,
            target: childNodeId,
            type: 'smoothstep',
            animated: false,
            style: { 
              stroke: isError ? '#f43f5e' : '#10b981', 
              strokeWidth: 1.5 
            },
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: isError ? '#f43f5e' : '#10b981' 
            },
          });
        });
      }

      // Update flag on RouteNode
      const routeNodeIndex = nodes.findIndex(n => n.id === routeId);
      if (routeNodeIndex !== -1) {
        nodes[routeNodeIndex].data.hasUnmapped = routeHasUnmapped;
      }
    });

    const layouted = getLayoutedElements(nodes, edges, 'LR', useSavedLayout);
    
    return {
      initialNodes: layouted.nodes,
      initialEdges: layouted.edges,
      counters,
      allUniquePermissions: Array.from(allRequiredCodes).map(code => {
        const meta = getPermMeta(code);
        return { code, ...meta };
      })
    };
  }, [routePermissions, groups, permissionsByGroup, pagePermissionScopes, searchQuery, routeTypeFilter, activeStatusFilter, permCodeSearch, permTypeFilter, layoutTrigger, useSavedLayout]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state nodes with initialNodes when filters or data change
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle highlights directly on current nodes/edges state to prevent resetting dragged layout
  React.useEffect(() => {
    setNodes(prevNodes => {
      if (!selectedRouteId && !selectedPermission) {
        return prevNodes.map(node => ({
          ...node,
          data: { ...node.data, dimmed: false, selected: false }
        }));
      }

      const activeNodeIds = new Set<string>();

      if (selectedRouteId) {
        const targetRouteId = selectedRouteId;
        activeNodeIds.add(targetRouteId);
        activeNodeIds.add(`route-access-hub-${targetRouteId}`);
        activeNodeIds.add(`route-action-hub-${targetRouteId}`);

        prevNodes.forEach(node => {
          if (node.id.startsWith(`route-access-perm-${targetRouteId}-`) || 
              node.id.startsWith(`route-action-perm-${targetRouteId}-`)) {
            activeNodeIds.add(node.id);
          }
        });
      } else if (selectedPermission) {
        const permCode = selectedPermission.code;
        prevNodes.forEach(node => {
          if (node.type === 'permissionChildNode' && node.data?.code === permCode) {
            activeNodeIds.add(node.id);
            const incomingEdge = edges.find(e => e.target === node.id);
            if (incomingEdge) {
              activeNodeIds.add(incomingEdge.source);
              const hubEdge = edges.find(e => e.target === incomingEdge.source);
              if (hubEdge) {
                activeNodeIds.add(hubEdge.source);
              }
            }
          }
        });
      }

      return prevNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          dimmed: !activeNodeIds.has(node.id),
          selected: node.id === selectedRouteId || (node.type === 'permissionChildNode' && node.data?.code === selectedPermission?.code)
        }
      }));
    });

    setEdges(prevEdges => {
      if (!selectedRouteId && !selectedPermission) {
        return prevEdges.map(edge => ({
          ...edge,
          style: { ...edge.style, opacity: 1 }
        }));
      }

      const targetRouteId = selectedRouteId;
      const permCode = selectedPermission?.code;

      return prevEdges.map(edge => {
        let isEdgeActive = false;
        
        if (targetRouteId) {
          const activeNodeIds = new Set<string>([
            targetRouteId,
            `route-access-hub-${targetRouteId}`,
            `route-action-hub-${targetRouteId}`
          ]);
          nodes.forEach(node => {
            if (node.id.startsWith(`route-access-perm-${targetRouteId}-`) || 
                node.id.startsWith(`route-action-perm-${targetRouteId}-`)) {
              activeNodeIds.add(node.id);
            }
          });
          isEdgeActive = activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target);
        } else if (permCode) {
          const activeNodeIds = new Set<string>();
          nodes.forEach(node => {
            if (node.type === 'permissionChildNode' && node.data?.code === permCode) {
              activeNodeIds.add(node.id);
              const incoming = edges.find(e => e.target === node.id);
              if (incoming) {
                activeNodeIds.add(incoming.source);
                const hubEdge = edges.find(e => e.target === incoming.source);
                if (hubEdge) {
                  activeNodeIds.add(hubEdge.source);
                }
              }
            }
          });
          isEdgeActive = activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target);
        }

        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: isEdgeActive ? 1 : 0.1
          }
        };
      });
    });
  }, [selectedRouteId, selectedPermission]);

  // Drag handler to persist custom layout positions
  const onNodeDragStop = useCallback((event: any, node: any) => {
    setUseSavedLayout(true);
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('perm_flow_layout');
        const positions = saved ? JSON.parse(saved) : {};
        positions[node.id] = { x: node.position.x, y: node.position.y };
        localStorage.setItem('perm_flow_layout', JSON.stringify(positions));
      } catch (e) {
        console.error('Failed to save layout position', e);
      }
    }
  }, []);

  // Handler to trigger temporary auto layout (disabling saved layout)
  const handleTriggerAutoLayout = useCallback(() => {
    setUseSavedLayout(false);
    setLayoutTrigger(prev => prev + 1);
  }, []);

  // Handler to clear custom layout positions and restore defaults
  const handleClearSavedLayout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('perm_flow_layout');
    }
    setUseSavedLayout(true);
    setLayoutTrigger(prev => prev + 1);
    setSelectedRouteId(null);
    setSelectedPermission(null);
  }, []);

  // Click handler for highlights and details panel
  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    if (node.type === 'routeNode') {
      setSelectedRouteId(prev => prev === node.id ? null : node.id);
      setSelectedPermission(null);
    } else if (node.type === 'permissionChildNode') {
      const permCode = node.data.code;
      const permMeta = allUniquePermissions.find(p => p.code === permCode);
      if (permMeta) {
        const sharedRoutes = routePermissions.filter(route => {
          const accessCodes = (route.permissions || []).map((p: any) => p.code || p);
          const actionScope = pagePermissionScopes?.find(s => s.route_path === route.route_path);
          const actionCodes = actionScope?.action_permissions || [];
          return accessCodes.includes(permCode) || actionCodes.includes(permCode);
        });
        
        setSelectedPermission({
          ...permMeta,
          permissionType: node.data.permissionType,
          sharedRoutes: sharedRoutes.map(r => {
            const isAccess = (r.permissions || []).map((p: any) => p.code || p).includes(permCode);
            const isAction = pagePermissionScopes?.find(s => s.route_path === r.route_path)?.action_permissions?.includes(permCode);
            let roleTypeStr = '';
            if (isAccess && isAction) roleTypeStr = 'Vào trang & Thao tác';
            else if (isAccess) roleTypeStr = 'Quyền vào trang';
            else if (isAction) roleTypeStr = 'Quyền thao tác';
            
            return {
              name: r.route_name,
              path: r.route_path,
              type: r.type,
              is_active: r.is_active,
              roleType: roleTypeStr
            };
          })
        });
      }
      setSelectedRouteId(null);
    } else {
      setSelectedRouteId(null);
      setSelectedPermission(null);
    }
  }, [allUniquePermissions, routePermissions, pagePermissionScopes, edges, nodes]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-50/20 overflow-hidden">
      {/* TOOLBAR & FILTERS */}
      <div className="px-6 py-4 bg-white border-b border-slate-200/65 flex flex-col gap-3 shrink-0 select-none shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            <input
              type="text"
              placeholder="Tìm route path/tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-44 transition-all placeholder:text-slate-400"
            />

            <select
              value={routeTypeFilter}
              onChange={(e) => setRouteTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-755 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-32 cursor-pointer"
            >
              <option value="all">Tất cả loại</option>
              <option value="page">Trang (Page)</option>
              <option value="api">API</option>
              <option value="feature">Chức năng</option>
            </select>

            <select
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-755 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-32 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Tắt</option>
            </select>

            <select
              value={permTypeFilter}
              onChange={(e) => setPermTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-755 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-36 cursor-pointer"
            >
              <option value="all">Tất cả loại quyền</option>
              <option value="route_access">Quyền vào trang</option>
              <option value="page_action">Quyền thao tác</option>
            </select>

            <input
              type="text"
              placeholder="Tìm mã quyền con..."
              value={permCodeSearch}
              onChange={(e) => setPermCodeSearch(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-44 transition-all placeholder:text-slate-400"
            />

            {(searchQuery || routeTypeFilter !== 'all' || activeStatusFilter !== 'all' || permCodeSearch || permTypeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRouteTypeFilter('all');
                  setActiveStatusFilter('all');
                  setPermCodeSearch('');
                  setPermTypeFilter('all');
                  setSelectedRouteId(null);
                  setSelectedPermission(null);
                }}
                className="text-xs font-bold text-red-500 hover:text-red-650 transition-colors"
              >
                Reset bộ lọc
              </button>
            )}

            <button
              onClick={handleTriggerAutoLayout}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-250 hover:bg-slate-50 rounded-lg shadow-sm transition-all cursor-pointer"
              title="Tính toán lại layout tự động hiện tại (không xóa bố cục đã lưu)"
            >
              Tự động sắp xếp
            </button>

            <button
              onClick={handleClearSavedLayout}
              className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-white border border-rose-250 hover:bg-rose-50 rounded-lg shadow-sm transition-all cursor-pointer"
              title="Xóa vị trí node đã lưu và tải lại bố cục tự động mặc định"
            >
              Xóa bố cục đã lưu
            </button>

            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 select-none pl-2 border-l border-slate-200" title="Bố cục tự động tính toán bởi dagre hoặc kéo thả tùy chỉnh">
              💡 Bạn có thể kéo thả các node trên sơ đồ để sắp xếp lại vị trí. Bố cục mới sẽ tự động được lưu.
            </span>

          </div>

          {/* Selection indicator */}
          {(selectedRouteId || selectedPermission) && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-150 text-xs font-semibold shrink-0">
              <span>{selectedRouteId ? 'Đang highlight 1 nhánh' : 'Đang chọn 1 quyền'}</span>
              <button 
                onClick={() => {
                  setSelectedRouteId(null);
                  setSelectedPermission(null);
                }}
                className="text-blue-500 hover:text-blue-700 font-bold ml-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* COUNTERS */}
        <div className="flex items-center gap-6 flex-wrap pt-2.5 border-t border-slate-100 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tổng Routes:</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200/60 font-black">{counters.totalRoutes}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Routes hoạt động:</span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 font-black">{counters.activeRoutesCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tổng quyền yêu cầu:</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-black">{counters.totalRequiredPerms}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Quyền lỗi/chưa nhóm:</span>
            <span className={`px-2 py-0.5 rounded-md border font-black ${
              counters.missingOrUnmappedCount > 0 
                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
                : 'bg-slate-100 text-slate-650 border-slate-200/60'
            }`}>
              {counters.missingOrUnmappedCount}
            </span>
          </div>
        </div>
      </div>

      {/* GRAPH CONTAINER */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div className="flex-1 h-full relative bg-slate-50/50">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/40 z-20 gap-2.5">
              <Route className="w-10 h-10 text-slate-350" />
              <div className="text-xs font-bold text-slate-500">Không tìm thấy kết quả phù hợp</div>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setRouteTypeFilter('all');
                  setActiveStatusFilter('all');
                  setPermCodeSearch('');
                  setSelectedRouteId(null);
                  setSelectedPermission(null);
                }}
                className="text-xs font-bold text-blue-650 hover:text-blue-700 underline animate-pulse"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={true}
            attributionPosition="bottom-right"
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#cbd5e1" gap={20} size={1.5} />
            <Controls />
            <MiniMap 
              nodeColor={(n) => {
                if (n.type === 'routeNode') return '#818cf8';
                if (n.type === 'routeAccessHubNode') return '#c7d2fe';
                if (n.type === 'pageActionHubNode') return '#fde68a';
                return n.data?.status === 'missing' || n.data?.status === 'unmapped' ? '#fda4af' : '#6ee7b7';
              }}
              maskColor="rgba(248, 250, 252, 0.7)"
              className="rounded-xl border border-slate-200 overflow-hidden shadow-sm"
            />
          </ReactFlow>
        </div>

        {/* DETAILS SIDE PANEL */}
        {(selectedPermission || selectedRouteId) && (() => {
          if (selectedPermission) {
            return (
              <div className="w-[320px] border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col gap-4 shrink-0 shadow-lg animate-fade-in relative z-10 select-none">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm">Chi tiết Quyền hạn</h4>
                  <button 
                    onClick={() => setSelectedPermission(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                  >
                    Đóng
                  </button>
                </div>

                <div className="flex flex-col gap-3.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã Quyền</span>
                    <div className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100 mt-1 select-all">
                      {selectedPermission.code}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên Quyền</span>
                    <div className="text-sm font-bold text-slate-850 mt-0.5 leading-snug">
                      {selectedPermission.name}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mô tả</span>
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                      {selectedPermission.desc || 'Chưa có mô tả chi tiết cho quyền này.'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhóm quyền gốc</span>
                    <div className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1.5">
                      <FolderKanban size={13} className="text-amber-500" />
                      {selectedPermission.groupName || 'Chưa phân nhóm'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vai trò trong trang</span>
                    <div className="text-xs font-bold text-slate-750 mt-0.5">
                      {selectedPermission.permissionType === 'route_access' ? 'Quyền vào trang (Route Guard)' : 'Quyền thao tác trong trang (Page Action)'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái cấu hình</span>
                    <div className="mt-1">
                      {selectedPermission.status === 'missing' ? (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded bg-red-50 text-red-650 border border-red-150 animate-pulse inline-block">
                          Chưa định nghĩa (Missing trong DB)
                        </span>
                      ) : selectedPermission.status === 'unmapped' ? (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded bg-amber-50 text-amber-600 border border-amber-150 inline-block">
                          Unmapped (Chưa phân nhóm)
                        </span>
                      ) : selectedPermission.status === 'proposed' ? (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded bg-slate-50 text-slate-600 border border-dashed border-slate-300 inline-block">
                          Đề xuất bổ sung
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-[10px] font-black rounded bg-emerald-50 text-emerald-600 border border-emerald-150 inline-block">
                          Đang hoạt động (Đã gán nhóm)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex flex-col gap-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Các trang sử dụng quyền này ({selectedPermission.sharedRoutes?.length || 0})
                  </span>
                  <div className="flex flex-col gap-2 mt-1 max-h-[220px] overflow-y-auto pr-1">
                    {selectedPermission.sharedRoutes && selectedPermission.sharedRoutes.length > 0 ? (
                      selectedPermission.sharedRoutes.map((r: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex flex-col gap-1 hover:bg-slate-100/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 truncate">{r.name}</span>
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${
                              r.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {r.is_active !== false ? 'Hoạt động' : 'Tắt'}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-indigo-500 truncate" title={r.path}>{r.path}</span>
                          <span className="text-[9px] font-bold text-slate-400 mt-0.5">{r.roleType}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 italic">Không có trang nào khác sử dụng quyền này.</div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (selectedRouteId) {
            const routeData = routePermissions.find(r => `route-${r._id || r.route_path}` === selectedRouteId);
            if (!routeData) return null;

            const actionScope = pagePermissionScopes?.find(s => s.route_path === routeData.route_path);
            const notes = actionScope?.notes || [];
            const accessCodes = (routeData.permissions || []).map((p: any) => p.code || p);
            const actionCodes = actionScope?.action_permissions || [];

            return (
              <div className="w-[320px] border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col gap-4 shrink-0 shadow-lg animate-fade-in relative z-10 select-none">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm">Chi tiết Trang</h4>
                  <button 
                    onClick={() => setSelectedRouteId(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                  >
                    Đóng
                  </button>
                </div>

                <div className="flex flex-col gap-3.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đường dẫn (Route)</span>
                    <div className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100 mt-1 select-all">
                      {routeData.route_path}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên trang hiển thị</span>
                    <div className="text-sm font-bold text-slate-850 mt-0.5 leading-snug">
                      {routeData.route_name}
                    </div>
                  </div>

                  {notes.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                        <ShieldCheck size={14} /> Ghi chú từ hệ thống
                      </span>
                      <ul className="list-disc pl-4 text-xs text-amber-800 space-y-1">
                        {notes.map((note: string, idx: number) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      Nguồn quyền vào trang ({accessCodes.length})
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {accessCodes.length > 0 ? accessCodes.map((code: string) => {
                        const meta = allUniquePermissions.find((p: any) => p.code === code) || { name: code, status: 'missing' };
                        return (
                          <div key={code} className="flex items-center gap-2 p-1.5 border border-slate-100 rounded-md bg-slate-50">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${meta.status === 'missing' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                            <span className="text-xs font-bold text-slate-700 truncate flex-1" title={meta.name}>{meta.name}</span>
                          </div>
                        );
                      }) : (
                        <div className="text-xs text-slate-400 italic">Không yêu cầu quyền.</div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      Nguồn quyền thao tác ({actionCodes.length})
                    </span>
                    <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                      {actionCodes.length > 0 ? actionCodes.map((code: string) => {
                        const meta = allUniquePermissions.find((p: any) => p.code === code) || { name: code, status: 'missing' };
                        const isProposed = meta.status === 'proposed';
                        return (
                          <div key={code} className={`flex items-center gap-2 p-1.5 border rounded-md ${isProposed ? 'bg-white border-dashed border-slate-300' : 'bg-slate-50 border-slate-100'}`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${meta.status === 'missing' ? 'bg-rose-500' : isProposed ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                            <span className={`text-xs font-bold truncate flex-1 ${isProposed ? 'text-slate-500' : 'text-slate-700'}`} title={meta.name}>{meta.name}</span>
                          </div>
                        );
                      }) : (
                        <div className="text-xs text-slate-400 italic">Không có quyền thao tác nào.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })()}
      </div>
    </div>
  );
}
