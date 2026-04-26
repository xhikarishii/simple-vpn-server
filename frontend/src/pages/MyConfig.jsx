import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button, 
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';

const MyConfig = () => {
  const [configData, setConfigData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/config', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConfigData(response.data);
      } catch (err) {
        setError('Failed to fetch VPN configuration.');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const downloadConfig = () => {
    if (!configData?.config) return;
    const element = document.createElement("a");
    const file = new Blob([configData.config], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "wg0-client.conf";
    document.body.appendChild(element);
    element.click();
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>My VPN Connection</Typography>
      
      <Grid container spacing={4}>
        {configData.type === 'wireguard' ? (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>WireGuard Configuration</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, p: 2, bgcolor: 'white', borderRadius: 2 }}>
                <img src={configData.qr} alt="WireGuard QR" style={{ width: '100%', maxWidth: 250 }} />
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                Scan this QR code with the WireGuard app on your mobile device.
              </Typography>
              
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<DownloadIcon />}
                onClick={downloadConfig}
              >
                Download .conf File
              </Button>
            </Paper>
          </Grid>
        ) : (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>L2TP/IPsec Credentials</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Server Address</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{configData.server}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Username</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{configData.username}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Password</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{configData.password}</Typography>
              </Box>
              
              <Box>
                <Typography variant="caption" color="text.secondary">IPsec Pre-Shared Key (PSK)</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{configData.psk}</Typography>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default MyConfig;
