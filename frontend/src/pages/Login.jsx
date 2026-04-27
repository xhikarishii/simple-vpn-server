import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Container, 
  Alert,
  CircularProgress,
  Avatar,
  Stack
} from '@mui/material';
import { ShieldOutlined } from '@mui/icons-material';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/login', { username, password });
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Access denied. Please check your system credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)'
    }}>
      <Container maxWidth="xs">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Avatar sx={{ 
            m: 2, 
            bgcolor: 'primary.main', 
            width: 56, 
            height: 56, 
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' 
          }}>
            <ShieldOutlined fontSize="large" />
          </Avatar>
          <Typography variant="h4" sx={{ 
            mb: 1, 
            fontWeight: 800, 
            background: 'linear-gradient(45deg, #818cf8, #ec4899)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent' 
          }}>
            VPN CORE
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
            Authorized Access Only
          </Typography>

          <Paper elevation={0} sx={{ 
            p: 4, 
            width: '100%', 
            borderRadius: 4, 
            bgcolor: 'background.paper',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {error && <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
            
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  required
                  fullWidth
                  label="Username"
                  autoFocus
                  variant="filled"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <TextField
                  required
                  fullWidth
                  label="Password"
                  type="password"
                  variant="filled"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{ 
                    mt: 2, 
                    height: 56, 
                    fontSize: '1rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2, 
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Enter Dashboard'}
                </Button>
              </Stack>
            </Box>
          </Paper>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 4, opacity: 0.5 }}>
            &copy; 2026 VPN CORE. Encrypted Infrastructure.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;
