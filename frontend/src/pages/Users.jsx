import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  TextField, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  Stack,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete, 
  QrCode, 
  Person,
  Security,
  VpnLock,
  Edit as EditIcon
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    vpn_type: 'wireguard',
    login_password: '',
    role: 'user'
  });

  const [editUser, setEditUser] = useState({
    id: null,
    username: '',
    password: '',
    login_password: '',
    role: ''
  });

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    try {
      await axios.post('/api/users', newUser);
      setOpen(false);
      setNewUser({ username: '', password: '', vpn_type: 'wireguard', login_password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdate = async () => {
    try {
      const payload = {
        role: editUser.role
      };
      if (editUser.password) payload.password = editUser.password;
      if (editUser.login_password) payload.login_password = editUser.login_password;

      await axios.put(`/api/users/${editUser.id}`, payload);
      setEditOpen(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  const openEdit = (user) => {
    setEditUser({
      id: user.id,
      username: user.username,
      password: '', // Don't show existing passwords
      login_password: '',
      role: user.role
    });
    setEditOpen(true);
  };

  const showConfig = async (id) => {
    try {
      const res = await axios.get(`/api/users/${id}/config`);
      setCurrentConfig(res.data);
      setConfigOpen(true);
    } catch (err) {
      alert('Failed to fetch configuration');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/users/${id}`);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  const UserRow = ({ user }) => (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: user.role === 'admin' ? 'secondary.main' : 'primary.main', width: 32, height: 32 }}>
            <Person fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.username}</Typography>
            <Typography variant="caption" color="text.secondary">{user.ip_address || 'Dynamic IP'}</Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip 
          label={user.role} 
          size="small" 
          color={user.role === 'admin' ? 'secondary' : 'default'}
          sx={{ fontWeight: 600, fontSize: '0.65rem' }}
        />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          {user.vpn_type === 'wireguard' ? <VpnLock fontSize="inherit" /> : <Security fontSize="inherit" />}
          <Typography variant="caption">{user.vpn_type ? user.vpn_type.toUpperCase() : 'NONE'}</Typography>
        </Stack>
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Tooltip title="Edit User">
            <IconButton size="small" onClick={() => openEdit(user)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {user.vpn_type === 'wireguard' && (
            <Tooltip title="View Config">
              <IconButton size="small" color="primary" onClick={() => showConfig(user.id)}>
                <QrCode fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {user.username !== 'admin' && (
            <Tooltip title="Delete User">
              <IconButton size="small" color="error" onClick={() => handleDelete(user.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );

  const UserCard = ({ user }) => (
    <Card sx={{ mb: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: user.role === 'admin' ? 'secondary.main' : 'primary.main' }}>
              <Person />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{user.username}</Typography>
              <Typography variant="caption" color="text.secondary">{user.ip_address || 'Dynamic IP'}</Typography>
            </Box>
          </Stack>
          <Chip label={user.role} size="small" variant="outlined" color={user.role === 'admin' ? 'secondary' : 'default'} />
        </Stack>
        <Divider sx={{ my: 2, opacity: 0.1 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            {user.vpn_type?.toUpperCase() || 'NONE'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(user)}>Edit</Button>
            {user.vpn_type === 'wireguard' && (
              <Button size="small" color="primary" startIcon={<QrCode />} onClick={() => showConfig(user.id)}>Config</Button>
            )}
            {user.username !== 'admin' && (
              <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(user.id)}>Delete</Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Users</Typography>
          <Typography color="text.secondary">Manage VPN access and dashboard administrators</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpen(true)}
          sx={{ borderRadius: 2, px: 3 }}
        >
          {isMobile ? 'Add' : 'Add User'}
        </Button>
      </Box>

      {isMobile ? (
        <Box>{users.map(user => <UserCard key={user.id} user={user} />)}</Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'transparent' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell>Identity</TableCell>
                <TableCell>Access Role</TableCell>
                <TableCell>VPN Protocol</TableCell>
                <TableCell align="right">Management</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => <UserRow key={user.id} user={user} />)}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add User Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>New Access Policy</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>Create a new user with specific VPN and dashboard permissions.</Typography>
          <TextField
            fullWidth label="Username" margin="normal" variant="outlined"
            value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <TextField
            fullWidth label="Dashboard Password" margin="normal" type="password" variant="outlined"
            helperText="Used for dashboard login"
            value={newUser.login_password} onChange={(e) => setNewUser({ ...newUser, login_password: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={newUser.role}
              label="Role"
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <MenuItem value="user">Standard User</MenuItem>
              <MenuItem value="admin">System Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>VPN Type</InputLabel>
            <Select
              value={newUser.vpn_type}
              label="VPN Type"
              onChange={(e) => setNewUser({ ...newUser, vpn_type: e.target.value })}
            >
              <MenuItem value="wireguard">WireGuard (Modern)</MenuItem>
              <MenuItem value="l2tp">L2TP/IPsec (Legacy)</MenuItem>
              <MenuItem value="none">No VPN Tunnel</MenuItem>
            </Select>
          </FormControl>
          {newUser.vpn_type === 'l2tp' && (
            <TextField
              fullWidth label="VPN Connection Password" margin="normal" type="password"
              helperText="Credentials for the L2TP/IPsec tunnel"
              value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreate} variant="contained" sx={{ px: 4 }}>Provision</Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>Edit User: {editUser.username}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>Update security credentials and access roles.</Typography>
          
          <TextField
            fullWidth label="New Dashboard Password" margin="normal" type="password" variant="outlined"
            placeholder="Leave blank to keep current"
            helperText="Used for dashboard login"
            value={editUser.login_password} onChange={(e) => setEditUser({ ...editUser, login_password: e.target.value })}
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Access Role</InputLabel>
            <Select
              value={editUser.role}
              label="Access Role"
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
            >
              <MenuItem value="user">Standard User</MenuItem>
              <MenuItem value="admin">System Admin</MenuItem>
            </Select>
          </FormControl>

          {/* Only show VPN password if they have a non-wireguard vpn */}
          {users.find(u => u.id === editUser.id)?.vpn_type === 'l2tp' && (
            <TextField
              fullWidth label="New VPN Connection Password" margin="normal" type="password"
              placeholder="Leave blank to keep current"
              helperText="Credentials for the L2TP/IPsec tunnel"
              value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setEditOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" sx={{ px: 4 }}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Config/QR Dialog */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>WireGuard Credentials</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {currentConfig && (
            <Stack spacing={3} alignItems="center">
              <Box sx={{ p: 3, bgcolor: 'white', display: 'inline-block', borderRadius: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                <QRCodeSVG value={currentConfig.config} size={240} />
              </Box>
              <Paper variant="outlined" sx={{ 
                p: 2, 
                bgcolor: '#0a0a0a', 
                borderRadius: 2, 
                width: '100%',
                maxHeight: 200,
                overflow: 'auto',
                textAlign: 'left'
              }}>
                <pre style={{ margin: 0, fontSize: '0.75rem', color: '#818cf8', fontFamily: 'monospace' }}>
                  {currentConfig.config}
                </pre>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setConfigOpen(false)} variant="outlined">Dismiss</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Users;
