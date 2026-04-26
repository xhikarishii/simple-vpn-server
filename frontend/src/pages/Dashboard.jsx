import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Divider,
  Chip
} from '@mui/material';
import axios from 'axios';

function Dashboard() {
  const [status, setStatus] = useState({ 
    vpn: { 
      wireguard: { active: false, port: null, details: null }, 
      l2tp: { active: false, details: null } 
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
    <Paper sx={{ p: 2, bgcolor: '#000', color: '#0f0', fontFamily: 'monospace', fontSize: '0.8rem', borderRadius: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#fff' }}>{title}</Typography>
        {port && <Chip label={`Port: ${port}`} size="small" sx={{ color: '#fff', borderColor: '#333' }} variant="outlined" />}
      </Box>
      <Divider sx={{ bgcolor: '#333', mb: 1 }} />
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {content || 'No status information available.'}
      </pre>
    </Paper>
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>System Status</Typography>
      
      {/* Detailed Status Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <StatusTerminal 
            title="WireGuard Interface & Peers" 
            content={status.vpn.wireguard.details} 
            port={status.vpn.wireguard.port}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StatusTerminal 
            title="L2TP/IPsec Services" 
            content={status.vpn.l2tp.details} 
          />
        </Grid>
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: status.vpn.wireguard.active ? 'success.dark' : 'error.dark', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6">WireGuard</Typography>
              <Typography variant="body1" sx={{ opacity: 0.8 }}>{status.vpn.wireguard.active ? 'Operational' : 'Stopped'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: status.vpn.l2tp.active ? 'success.dark' : 'error.dark', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6">L2TP/IPsec</Typography>
              <Typography variant="body1" sx={{ opacity: 0.8 }}>{status.vpn.l2tp.active ? 'Operational' : 'Stopped'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6">System Uptime</Typography>
              <Typography variant="body1" sx={{ opacity: 0.8 }}>{Math.floor(status.uptime / 60)} minutes</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
