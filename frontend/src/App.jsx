import React, { useState, useEffect } from 'react';
import { 
  createTheme, 
  ThemeProvider, 
  CssBaseline, 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  AppBar, 
  Toolbar, 
  IconButton,
  useMediaQuery,
  ListItemButton,
  Avatar,
  Divider,
  Container
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import People from '@mui/icons-material/People';
import RouterIcon from '@mui/icons-material/Router';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToApp from '@mui/icons-material/ExitToApp';
import VpnKey from '@mui/icons-material/VpnKey';
import MenuIcon from '@mui/icons-material/Menu';
import History from '@mui/icons-material/History';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import { BrowserRouter as RouterDom, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Networking from './pages/Networking';
import SettingsPage from './pages/Settings';
import Security from './pages/Security';
import Login from './pages/Login';
import MyConfig from './pages/MyConfig';
import Logs from './pages/Logs';

const drawerWidth = 260;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
    secondary: { main: '#ec4899' },
    background: { default: '#0f172a', paper: '#1e293b' },
    text: { primary: '#f8fafc', secondary: '#94a3b8' }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'none',
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0f172a',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          margin: '4px 12px',
          borderRadius: '8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#818cf8',
            '& .MuiListItemIcon-root': { color: '#818cf8' },
            '&:hover': { backgroundColor: 'rgba(99, 102, 241, 0.18)' }
          }
        }
      }
    }
  }
});

function NavigationContent({ menuItems, onLogout, user, currentPath, onClose }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
          <ShieldOutlined />
        </Avatar>
        <Typography variant="h6" sx={{ background: 'linear-gradient(45deg, #818cf8, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          VPN CORE
        </Typography>
      </Box>
      <Divider sx={{ opacity: 0.1 }} />
      <List sx={{ flexGrow: 1, pt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton 
              component={Link} 
              to={item.path} 
              selected={currentPath === item.path}
              onClick={onClose}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ opacity: 0.1 }} />
      <Box sx={{ p: 2 }}>
        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">Logged in as</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.username}</Typography>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', opacity: 0.6 }}>{user.role}</Typography>
        </Box>
        <ListItemButton onClick={onLogout} sx={{ color: 'error.light' }}>
          <ListItemIcon><ExitToApp color="error" /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </Box>
    </Box>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('username');

    if (token) {
      setUser({ token, role, username });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      document.title = 'VPN CORE | Login';
      return;
    }

    const items = user.role === 'admin' ? [
      { text: 'Dashboard', path: '/' },
      { text: 'Users', path: '/users' },
      { text: 'Networking', path: '/networking' },
      { text: 'Security', path: '/security' },
      { text: 'Settings', path: '/settings' },
    ] : [
      { text: 'My Connection', path: '/my-config' },
    ];

    const currentItem = items.find(item => item.path === location.pathname);
    const pageTitle = currentItem ? currentItem.text : 'VPN Control';
    document.title = `VPN CORE | ${pageTitle}`;
  }, [location.pathname, user, loading]);

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', data.username);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const menuItems = user.role === 'admin' ? [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Users', icon: <People />, path: '/users' },
    { text: 'Networking', icon: <RouterIcon />, path: '/networking' },
    { text: 'Security', icon: <ShieldOutlined />, path: '/security' },
    { text: 'Logs', icon: <History />, path: '/logs' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ] : [
    { text: 'My Connection', icon: <VpnKey />, path: '/my-config' },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` } }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'VPN Control'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
        >
          <NavigationContent 
            menuItems={menuItems} 
            onLogout={handleLogout} 
            user={user} 
            currentPath={location.pathname}
            onClose={() => setMobileOpen(false)}
          />
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
          open
        >
          <NavigationContent 
            menuItems={menuItems} 
            onLogout={handleLogout} 
            user={user} 
            currentPath={location.pathname}
            onClose={() => {}}
          />
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />
        <Container maxWidth="xl" sx={{ p: 0 }}>
          <Routes>
            {user.role === 'admin' ? (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/users" element={user.role === 'admin' ? <Users /> : <Navigate to="/my-config" />} />
                <Route path="/networking" element={user.role === 'admin' ? <Networking /> : <Navigate to="/my-config" />} />
                <Route path="/security" element={user.role === 'admin' ? <Security /> : <Navigate to="/my-config" />} />
                <Route path="/logs" element={user.role === 'admin' ? <Logs /> : <Navigate to="/my-config" />} />
                <Route path="/settings" element={user.role === 'admin' ? <SettingsPage /> : <Navigate to="/my-config" />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route path="/my-config" element={<MyConfig />} />
                <Route path="*" element={<Navigate to="/my-config" replace />} />
              </>
            )}
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterDom>
        <AppContent />
      </RouterDom>
    </ThemeProvider>
  );
}

export default App;
