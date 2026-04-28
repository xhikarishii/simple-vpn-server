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
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Alert,
  Grid,
  CircularProgress
} from '@mui/material';
import Shield from '@mui/icons-material/Shield';
import Delete from '@mui/icons-material/Delete';
import Sync from '@mui/icons-material/Sync';
import Add from '@mui/icons-material/Add';
import GppBad from '@mui/icons-material/GppBad';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Public from '@mui/icons-material/Public';
import History from '@mui/icons-material/History';
import axios from 'axios';

function Security() {
  const [lists, setLists] = useState([]);
  const [logs, setLogs] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [open, setOpen] = useState(false);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newList, setNewList] = useState({ name: '', url: '', type: 'ip' });
  const [newWhitelist, setNewWhitelist] = useState({ ip_or_subnet: '', description: '' });

  const popularLists = [
    { name: 'HaGeZi Multi Normal (Adblock)', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/multi.txt', type: 'domain' },
    { name: 'OISD Basic (Malware/Ads)', url: 'https://abp.oisd.nl/basic/', type: 'domain' },
    { name: 'Abuse.ch Feodo Tracker (Botnets)', url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt', type: 'ip' },
    { name: 'Firehol Level 1 (Critical IPs)', url: 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset', type: 'ip' },
    { name: 'StevenBlack Unified Hosts', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', type: 'domain' }
  ];

  const handlePopularSelect = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      setNewList({ name: '', url: '', type: 'ip' });
    } else {
      const selected = popularLists.find(l => l.url === val);
      if (selected) {
        setNewList({ name: selected.name, url: selected.url, type: selected.type });
      }
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [listRes, logRes, whitelistRes] = await Promise.all([
        axios.get('/api/blocklists'),
        axios.get('/api/logs'),
        axios.get('/api/whitelist')
      ]);
      setLists(Array.isArray(listRes.data) ? listRes.data : []);
      setLogs(Array.isArray(logRes.data) ? logRes.data : []);
      setWhitelist(Array.isArray(whitelistRes.data) ? whitelistRes.data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch security data', err);
      setError('Could not connect to security services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await axios.post('/api/blocklists', newList);
      setOpen(false);
      setNewList({ name: '', url: '', type: 'ip' });
      fetchData();
    } catch (err) {
      console.error('Failed to create blocklist', err);
      setError('Failed to add blocklist. Check URL and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Remove this blocklist?')) {
      try {
        await axios.delete(`/api/blocklists/${id}`);
        fetchData();
      } catch (err) {
        setError('Failed to delete blocklist.');
      }
    }
  };

  const handleCreateWhitelist = async () => {
    setSubmitting(true);
    try {
      await axios.post('/api/whitelist', newWhitelist);
      setWhitelistOpen(false);
      setNewWhitelist({ ip_or_subnet: '', description: '' });
      fetchData();
    } catch (err) {
      setError('Failed to add IP to whitelist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWhitelist = async (id) => {
    if (window.confirm('Remove this IP from whitelist?')) {
      try {
        await axios.delete(`/api/whitelist/${id}`);
        fetchData();
      } catch (err) {
        setError('Failed to delete whitelist entry.');
      }
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/blocklists/sync');
      fetchData();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Security Center</Typography>
          <Typography color="text.secondary">Automated threat protection and adblocking</Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button 
            variant="outlined" 
            startIcon={<Sync />} 
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Force Sync'}
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => setOpen(true)}
            disabled={submitting || syncing}
          >
            Add List
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}
      {syncing && <LinearProgress sx={{ mb: 4, borderRadius: 2 }} />}

      <Grid container spacing={4}>
        {/* Blocklists Management */}
        <Grid item xs={12}>
          <Paper sx={{ p: 0, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', mb: 4 }}>
            <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Protection Lists</Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Provider / Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Last Update</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(lists) ? lists : []).map((list) => (
                    <TableRow key={list.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{list.name}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>{list.url}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={list.type === 'ip' ? <Public fontSize="small" /> : <Shield fontSize="small" />}
                          label={list.type === 'ip' ? 'Malicious IP' : 'Adblock (DNS)'} 
                          size="small" 
                          variant="outlined"
                          color={list.type === 'ip' ? 'error' : 'success'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{list.last_updated ? new Date(list.last_updated).toLocaleString() : 'Pending'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => handleDelete(list.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lists.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No blocklists configured.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Whitelist Management */}
          <Paper sx={{ p: 0, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <Box sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Authorized IPs (Whitelist)</Typography>
              <Button size="small" startIcon={<Add />} onClick={() => setWhitelistOpen(true)} disabled={submitting || syncing}>Add IP</Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>IP / Subnet</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {whitelist.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.light' }}>{item.ip_or_subnet}</TableCell>
                      <TableCell color="text.secondary">{item.description}</TableCell>
                      <TableCell align="right">
                        <IconButton color="error" size="small" onClick={() => handleDeleteWhitelist(item.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {whitelist.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <Typography variant="caption" color="text.secondary">No manual whitelist entries. (Private ranges are whitelisted by default)</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Add Protection List</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth variant="filled" disabled={submitting}>
              <InputLabel>Select from Directory</InputLabel>
              <Select defaultValue="custom" onChange={handlePopularSelect}>
                <MenuItem value="custom">-- Custom / Other --</MenuItem>
                {popularLists.map(l => (
                  <MenuItem key={l.url} value={l.url}>{l.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth label="List Name" variant="filled"
              disabled={submitting}
              placeholder="e.g. AlienVault, AdGuard"
              value={newList.name} onChange={(e) => setNewList({ ...newList, name: e.target.value })}
            />
            <TextField
              fullWidth label="Source URL" variant="filled"
              disabled={submitting}
              placeholder="https://.../list.txt"
              value={newList.url} onChange={(e) => setNewList({ ...newList, url: e.target.value })}
            />
            <FormControl fullWidth variant="filled" disabled={submitting}>
              <InputLabel>List Type</InputLabel>
              <Select
                value={newList.type}
                onChange={(e) => setNewList({ ...newList, type: e.target.value })}
              >
                <MenuItem value="ip">Malicious IPs (Firewall Level)</MenuItem>
                <MenuItem value="domain">Adblock/Malware Hosts (DNS Level)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)} color="inherit" disabled={submitting}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" sx={{ px: 4 }} disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Add List'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Whitelist Dialog */}
      <Dialog open={whitelistOpen} onClose={() => setWhitelistOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Authorize IP / Subnet</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Authorized IPs bypass all malicious IP blocklists. Use this to prevent accidental lockout of your own infrastructure.
            </Typography>
            <TextField
              fullWidth label="IP or Subnet" variant="filled"
              disabled={submitting}
              placeholder="e.g. 1.2.3.4 or 1.2.3.0/24"
              value={newWhitelist.ip_or_subnet} 
              onChange={(e) => setNewWhitelist({ ...newWhitelist, ip_or_subnet: e.target.value })}
            />
            <TextField
              fullWidth label="Description" variant="filled"
              disabled={submitting}
              placeholder="e.g. Home Office, Backup Server"
              value={newWhitelist.description} 
              onChange={(e) => setNewWhitelist({ ...newWhitelist, description: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setWhitelistOpen(false)} color="inherit" disabled={submitting}>Cancel</Button>
          <Button onClick={handleCreateWhitelist} variant="contained" sx={{ px: 4 }} disabled={submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Authorize'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Security;
