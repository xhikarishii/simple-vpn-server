import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  TextField, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  Stack,
  Chip,
  Card,
  CardContent,
  IconButton,
  Button,
  Grid
} from '@mui/material';
import {
  History,
  Search,
  FilterList,
  Security,
  Public,
  Info
} from '@mui/icons-material';
import axios from 'axios';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    start: '',
    end: '',
    type: 'all'
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.start) params.append('start', filters.start);
      if (filters.end) params.append('end', filters.end);
      if (filters.type !== 'all') params.append('type', filters.type);

      const res = await axios.get(`/api/logs?${params.toString()}`);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLogIcon = (type) => {
    switch (type) {
      case 'dns_block': return <Security fontSize="small" />;
      case 'ip_block': return <Public fontSize="small" />;
      default: return <Info fontSize="small" />;
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'dns_block': return 'warning';
      case 'ip_block': return 'error';
      default: return 'info';
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>System Logs</Typography>
        <Typography color="text.secondary">Monitor blocked attempts and security events</Typography>
      </Box>

      <Card sx={{ mb: 4, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Start Time"
                type="datetime-local"
                variant="filled"
                InputLabelProps={{ shrink: true }}
                value={filters.start}
                onChange={(e) => setFilters({ ...filters, start: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="End Time"
                type="datetime-local"
                variant="filled"
                InputLabelProps={{ shrink: true }}
                value={filters.end}
                onChange={(e) => setFilters({ ...filters, end: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth variant="filled">
                <InputLabel>Event Type</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  <MenuItem value="all">All Events</MenuItem>
                  <MenuItem value="dns_block">DNS Blocks</MenuItem>
                  <MenuItem value="ip_block">IP Blocks</MenuItem>
                  <MenuItem value="info">System Info</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                fullWidth 
                variant="contained" 
                startIcon={<Search />} 
                onClick={fetchLogs}
                sx={{ height: 56, borderRadius: 2 }}
              >
                Filter Logs
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'transparent' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Source IP</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Chip 
                    icon={getLogIcon(log.type)}
                    label={log.type.replace('_', ' ').toUpperCase()} 
                    size="small" 
                    color={getLogColor(log.type)} 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{log.source_ip || '-'}</TableCell>
                <TableCell>{log.details}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                  <Typography color="text.secondary">No logs found for the selected period.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default Logs;
