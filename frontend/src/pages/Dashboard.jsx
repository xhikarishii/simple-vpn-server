import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, Card, CardContent } from '@mui/material';
import axios from 'axios';

function Dashboard() {
  const [status, setStatus] = useState({ vpn: { wireguard: false, l2tp: false }, uptime: 0 });

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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: status.vpn.wireguard ? 'success.dark' : 'error.dark' }}>
            <CardContent>
              <Typography variant="h6">WireGuard</Typography>
              <Typography variant="body1">{status.vpn.wireguard ? 'Running' : 'Stopped'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: status.vpn.l2tp ? 'success.dark' : 'error.dark' }}>
            <CardContent>
              <Typography variant="h6">L2TP/IPsec</Typography>
              <Typography variant="body1">{status.vpn.l2tp ? 'Running' : 'Stopped'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Uptime</Typography>
              <Typography variant="body1">{Math.floor(status.uptime / 60)} minutes</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
