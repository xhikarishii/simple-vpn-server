import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Divider,
  Chip,
  Avatar,
  Stack
} from '@mui/material';
import {
  Timer,
  VerifiedUser,
  ErrorOutline,
  Terminal,
  SettingsInputComponent,
  Shield,
  Public,
  Security,
  Block
} from '@mui/icons-material';
import axios from 'axios';

function Dashboard() {
  const [status, setStatus] = useState({ 
    vpn: { 
      wireguard: { active: false, port: null, details: null }, 
      l2tp: { active: false, details: null } 
    }, 
    security: {
      blockedIps: 0,
      blockedDomains: 0,
      firewallBlocks: 0,
      dnsBlocks: 0
    },
    uptime: 0 
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get('/api/status');
        setStatus(res.data);
      } catch (err) {
        console.error('Failed to fetch status', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const StatusTerminal = ({ title, content, port }) => (
    <Paper sx={{ 
      p: 0, 
      bgcolor: '#0f172a', 
      borderRadius: 2, 
      height: '100%', 
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
      <Box sx={{ 
        px: 2, 
        py: 1, 
        bgcolor: 'rgba(255,255,255,0.03)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Terminal sx={{ fontSize: '1rem', color: 'primary.light' }} />
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', textTransform: 'uppercase' }}>
            {title}
          </Typography>
        </Stack>
        {port && <Chip label={`UDP: ${port}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
      </Box>
      <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
        <pre style={{ 
          margin: 0, 
          whiteSpace: 'pre-wrap', 
          fontFamily: '"Fira Code", "JetBrains Mono", monospace', 
          fontSize: '0.75rem',
          color: '#cbd5e1'
        }}>
          {content || 'Establishing connection to daemon...'}
        </pre>
      </Box>
    </Paper>
  );

  const StatCard = ({ title, value, icon, active }) => (
    <Card sx={{ 
      height: '100%', 
      borderRadius: 3, 
      background: active ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
      border: active ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
      }
    }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ 
            bgcolor: active ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.05)', 
            color: active ? 'primary.main' : 'text.secondary' 
          }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {value}
              </Typography>
              {active !== undefined && (
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: active ? 'success.main' : 'error.main',
                  boxShadow: active ? '0 0 10px #10b981' : 'none'
                }} />
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Health Overview</Typography>
        <Typography color="text.secondary">Real-time status of your VPN infrastructure</Typography>
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title="WireGuard Status" 
            value={status.vpn.wireguard.active ? 'OPERATIONAL' : 'OFFLINE'} 
            icon={status.vpn.wireguard.active ? <VerifiedUser /> : <ErrorOutline />}
            active={status.vpn.wireguard.active}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title="L2TP/IPsec Status" 
            value={status.vpn.l2tp.active ? 'OPERATIONAL' : 'OFFLINE'} 
            icon={status.vpn.l2tp.active ? <VerifiedUser /> : <ErrorOutline />}
            active={status.vpn.l2tp.active}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard 
            title="System Uptime" 
            value={`${Math.floor(status.uptime / 60)} Minutes`} 
            icon={<Timer />}
          />
        </Grid>
      </Grid>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Security Enforcement</Typography>
        <Typography color="text.secondary">Active filtering and blocking metrics</Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Active IP Blacklist" 
            value={status.security.blockedIps.toLocaleString()} 
            icon={<Security />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="DNS Adblock List" 
            value={status.security.blockedDomains.toLocaleString()} 
            icon={<Public />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Firewall Blocks" 
            value={status.security.firewallBlocks.toLocaleString()} 
            icon={<Block color="error" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="DNS Blocks" 
            value={status.security.dnsBlocks.toLocaleString()} 
            icon={<Shield color="warning" />}
          />
        </Grid>
      </Grid>

      {/* Detailed Status Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <StatusTerminal 
            title="WireGuard Live Logs" 
            content={status.vpn.wireguard.details} 
            port={status.vpn.wireguard.port}
          />
        </Grid>
        <Grid item xs={12} lg={6}>
          <StatusTerminal 
            title="L2TP/IPsec Process Tree" 
            content={status.vpn.l2tp.details} 
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
