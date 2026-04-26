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
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete,
  Router as RouterIcon,
  CompareArrows,
  Dns,
  Security
} from '@mui/icons-material';
import axios from 'axios';

function Networking() {
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [newRule, setNewRule] = useState({ 
    external_port: '', internal_ip: '', internal_port: '', protocol: 'tcp', description: '' 
  });

  const fetchRules = async () => {
    try {
      const res = await axios.get('/api/rules');
      setRules(res.data);
    } catch (err) {
      console.error('Failed to fetch rules', err);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleCreate = async () => {
    try {
      await axios.post('/api/rules', newRule);
      setOpen(false);
      setNewRule({ external_port: '', internal_ip: '', internal_port: '', protocol: 'tcp', description: '' });
      fetchRules();
    } catch (err) {
      console.error('Failed to create rule', err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this port forwarding rule?')) {
      try {
        await axios.delete(`/api/rules/${id}`);
        fetchRules();
      } catch (err) {
        console.error('Failed to delete rule', err);
      }
    }
  };

  const RuleCard = ({ rule }) => (
    <Card sx={{ mb: 2, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{rule.description || 'Unnamed Rule'}</Typography>
          <Chip label={rule.protocol.toUpperCase()} size="small" color="primary" sx={{ fontWeight: 700 }} />
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" color="text.secondary">EXTERNAL</Typography>
            <Typography variant="h6">{rule.external_port}</Typography>
          </Box>
          <CompareArrows sx={{ opacity: 0.3 }} />
          <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" color="text.secondary">INTERNAL</Typography>
            <Typography variant="body2">{rule.internal_ip}</Typography>
            <Typography variant="h6">{rule.internal_port}</Typography>
          </Box>
        </Stack>
        <Button 
          fullWidth 
          variant="outlined" 
          color="error" 
          startIcon={<Delete />} 
          onClick={() => handleDelete(rule.id)}
          sx={{ borderRadius: 2 }}
        >
          Remove Rule
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Networking</Typography>
          <Typography color="text.secondary">Configure port forwarding and firewall policies</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpen(true)}
          sx={{ borderRadius: 2, px: 3 }}
        >
          {isMobile ? 'Add' : 'Add Rule'}
        </Button>
      </Box>

      {isMobile ? (
        <Box>{rules.map(rule => <RuleCard key={rule.id} rule={rule} />)}</Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'transparent' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>External Port</TableCell>
                <TableCell>Internal Destination</TableCell>
                <TableCell>Protocol</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{rule.description}</TableCell>
                  <TableCell>
                    <Chip label={rule.external_port} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{rule.internal_ip}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.5 }}>:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{rule.internal_port}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={rule.protocol.toUpperCase()} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete Rule">
                      <IconButton color="error" onClick={() => handleDelete(rule.id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                    <Typography color="text.secondary">No port forwarding rules defined.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>New Firewall Rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth label="Description" variant="filled"
              placeholder="e.g. Web Server, Game Port"
              value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="External Port" variant="filled" type="number"
                  value={newRule.external_port} onChange={(e) => setNewRule({ ...newRule, external_port: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Internal Port" variant="filled" type="number"
                  value={newRule.internal_port} onChange={(e) => setNewRule({ ...newRule, internal_port: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth label="Internal Client IP" variant="filled"
              placeholder="e.g. 10.8.0.2"
              value={newRule.internal_ip} onChange={(e) => setNewRule({ ...newRule, internal_ip: e.target.value })}
            />
            <FormControl fullWidth variant="filled">
              <InputLabel>Protocol</InputLabel>
              <Select
                value={newRule.protocol}
                onChange={(e) => setNewRule({ ...newRule, protocol: e.target.value })}
              >
                <MenuItem value="tcp">TCP (Reliable)</MenuItem>
                <MenuItem value="udp">UDP (Fast/Gaming)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreate} variant="contained" sx={{ px: 4 }}>Create Rule</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Networking;
