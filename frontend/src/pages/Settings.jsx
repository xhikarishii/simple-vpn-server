import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Grid, 
  Paper, 
  Divider, 
  Alert, 
  CircularProgress,
  Stack,
  CardHeader,
  Avatar,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import { 
  Language, 
  VpnLock, 
  Security, 
  Save,
  NetworkCheck,
  History
} from '@mui/icons-material';
import axios from 'axios';

const SettingsCard = ({ title, subtitle, icon, children }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <CardHeader
      avatar={<Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: 'primary.main' }}>{icon}</Avatar>}
      title={<Typography variant="h6">{title}</Typography>}
      subheader={<Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    />
    <Divider sx={{ opacity: 0.1 }} />
    <CardContent sx={{ flexGrow: 1 }}>
      <Stack spacing={2}>
        {children}
      </Stack>
    </CardContent>
  </Card>
);

function Settings() {
  const [settings, setSettings] = useState({
    server_endpoint: '',
    wg_subnet: '10.8.0.1/24',
    wg_port: '13895',
    ovpn_subnet: '10.10.0.0',
    ovpn_port: '443',
    ovpn_proto: 'udp',
    log_retention_days: '7'
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
      setMessage({ type: 'success', text: 'Configuration updated and services restarted successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to apply configuration. Please check your inputs.' });
    } finally {
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>System Settings</Typography>
          <Typography color="text.secondary">Configure your VPN server core parameters</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={!saving && <Save />} 
          onClick={handleSave}
          disabled={saving}
          sx={{ px: 4, py: 1.5, borderRadius: 2, boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)' }}
        >
          {saving ? <CircularProgress size={24} color="inherit" /> : 'Apply Changes'}
        </Button>
      </Box>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>{message.text}</Alert>
      )}

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} lg={4}>
          <SettingsCard 
            title="General Networking" 
            subtitle="Base connectivity and public access"
            icon={<Language />}
          >
            <TextField
              fullWidth label="Public Endpoint" 
              variant="filled"
              disabled={saving}
              helperText="The IP address or domain clients use to connect."
              value={settings.server_endpoint}
              onChange={(e) => setSettings({ ...settings, server_endpoint: e.target.value })}
              placeholder="e.g. 1.2.3.4"
            />
          </SettingsCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <SettingsCard 
            title="WireGuard Core" 
            subtitle="L3 encryption and tunneling settings"
            icon={<VpnLock />}
          >
            <TextField
              fullWidth label="Internal Subnet" 
              variant="filled"
              disabled={saving}
              value={settings.wg_subnet}
              onChange={(e) => setSettings({ ...settings, wg_subnet: e.target.value })}
            />
            <TextField
              fullWidth label="UDP Listen Port" 
              variant="filled"
              type="number"
              disabled={saving}
              value={settings.wg_port}
              onChange={(e) => setSettings({ ...settings, wg_port: e.target.value })}
            />
          </SettingsCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <SettingsCard 
            title="OpenVPN Core" 
            subtitle="Modern SSL/TLS tunneling settings"
            icon={<Security />}
          >
            <TextField
              fullWidth label="Internal Subnet" 
              variant="filled"
              disabled={saving}
              value={settings.ovpn_subnet}
              onChange={(e) => setSettings({ ...settings, ovpn_subnet: e.target.value })}
            />
            <TextField
              fullWidth label="UDP Listen Port" 
              variant="filled"
              type="number"
              disabled={saving}
              value={settings.ovpn_port}
              onChange={(e) => setSettings({ ...settings, ovpn_port: e.target.value })}
            />
            <TextField
              fullWidth label="Protocol" 
              variant="filled"
              disabled={saving}
              value={settings.ovpn_proto}
              onChange={(e) => setSettings({ ...settings, ovpn_proto: e.target.value })}
              placeholder="udp or tcp"
            />
          </SettingsCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <SettingsCard 
            title="Maintenance" 
            subtitle="Logging and data retention"
            icon={<History />}
          >
            <TextField
              fullWidth label="Log Retention (Days)" 
              variant="filled"
              type="number"
              disabled={saving}
              value={settings.log_retention_days}
              onChange={(e) => setSettings({ ...settings, log_retention_days: e.target.value })}
              helperText="Logs older than this will be automatically deleted."
            />
          </SettingsCard>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Settings;
