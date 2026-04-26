import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, TextField, Button, Grid, Paper, Divider, Alert, CircularProgress 
} from '@mui/material';
import axios from 'axios';

function Settings() {
  const [settings, setSettings] = useState({
    server_endpoint: '',
    wg_subnet: '10.8.0.1/24',
    wg_port: '51820',
    l2tp_local_ip: '10.9.0.1',
    l2tp_ip_range: '10.9.0.2-10.9.0.255',
    l2tp_psk: 'defaultpsk'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/settings');
        setSettings(prev => ({ ...prev, ...res.data }));
      } catch (err) {
        console.error('Failed to fetch settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await axios.post('/api/settings', settings);
      setMessage({ type: 'success', text: 'Settings saved and services restarted.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Settings</Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>General / Networking</Typography>
            <TextField
              fullWidth label="Server Public Endpoint (IP/Domain)" margin="normal"
              value={settings.server_endpoint}
              onChange={(e) => setSettings({ ...settings, server_endpoint: e.target.value })}
              placeholder="e.g. 1.2.3.4"
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>WireGuard Configuration</Typography>
            <TextField
              fullWidth label="WireGuard Subnet" margin="normal"
              value={settings.wg_subnet}
              onChange={(e) => setSettings({ ...settings, wg_subnet: e.target.value })}
            />
            <TextField
              fullWidth label="WireGuard Port" margin="normal" type="number"
              value={settings.wg_port}
              onChange={(e) => setSettings({ ...settings, wg_port: e.target.value })}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>L2TP/IPsec Configuration</Typography>
            <TextField
              fullWidth label="L2TP Local IP" margin="normal"
              value={settings.l2tp_local_ip}
              onChange={(e) => setSettings({ ...settings, l2tp_local_ip: e.target.value })}
            />
            <TextField
              fullWidth label="L2TP IP Range" margin="normal"
              value={settings.l2tp_ip_range}
              onChange={(e) => setSettings({ ...settings, l2tp_ip_range: e.target.value })}
            />
            <TextField
              fullWidth label="IPsec Pre-Shared Key (PSK)" margin="normal"
              value={settings.l2tp_psk}
              onChange={(e) => setSettings({ ...settings, l2tp_psk: e.target.value })}
            />
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Button 
          variant="contained" 
          size="large" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save & Apply Configuration'}
        </Button>
      </Box>
    </Box>
  );
}

export default Settings;
