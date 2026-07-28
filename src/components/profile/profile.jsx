import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Container,
  TextField,
  Select,
  MenuItem,
  Button,
  Grid,
  Avatar,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  InputAdornment,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteIcon from '@mui/icons-material/Delete';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ReactAvatarEditor from 'react-avatar-editor';
import { format, parseISO } from 'date-fns';
import apiRequest from "../customHooks/apiRequest";

const API_BASE = 'http://127.0.0.1:8000/users/';

const ProfileContext = createContext();

export const ProfileProvider = ({ children }) => {
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profileError, setProfileError] = useState('');

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const response = await apiRequest({ url: `${API_BASE}profile/list/`, method: 'GET' });
      setProfiles(response.data);
    } catch (err) {
      setProfileError('Failed to fetch profiles');
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return (
    <ProfileContext.Provider value={{ profiles, setProfiles, fetchProfiles, loadingProfiles, profileError }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfiles = () => useContext(ProfileContext);

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props} isDropDisabled={false}>{children}</Droppable>;
};

const Profile = () => {
  const { profiles, setProfiles, fetchProfiles, loadingProfiles, profileError } = useProfiles();

  const [userData, setUserData] = useState({
    username: '',
    email: '',
    phone_number: '',
    theme: 'light',
    color: 0,
    birthdate: null,
    email_verified: false,
    phone_number_verified: false,
  });

  const [loadingUser, setLoadingUser] = useState(true);
  const [passwordStatusLoading, setPasswordStatusLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(null);
  const [passwordOperationLoading, setPasswordOperationLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deletePasswordDialogOpen, setDeletePasswordDialogOpen] = useState(false);

  const [passwordData, setPasswordData] = useState({
    password: '',
    confirm_password: '',
    new_password: '',
    new_confirm_password: '',
  });

  const [deletePasswordData, setDeletePasswordData] = useState({
    password: '',
    confirm_password: '',
  });

  const [newProfile, setNewProfile] = useState({ image: null, order: 0 });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [circularCrop, setCircularCrop] = useState(false);
  const editorRef = useRef(null);

  const COLOR_CHOICES = [
    { value: 0, label: 'Default' },
    { value: 1, label: 'Red' },
    { value: 2, label: 'Blue' },
    { value: 3, label: 'Green' },
    { value: 4, label: 'Yellow' },
    { value: 5, label: 'Purple' },
    { value: 6, label: 'Orange' },
    { value: 7, label: 'Pink' },
    { value: 8, label: 'Teal' },
    { value: 9, label: 'Indigo' },
    { value: 10, label: 'Gray' },
    { value: 11, label: 'Black' },
    { value: 12, label: 'White' },
  ];

  const THEME_CHOICES = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  useEffect(() => {
    fetchUserData();
    fetchPasswordStatus();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchUserData = async () => {
    setLoadingUser(true);
    try {
      const response = await apiRequest({ url: `${API_BASE}user/`, method: 'GET' });
      const user = response.data.user;
      const validColor = COLOR_CHOICES.find(opt => opt.value === user.color)?.value || COLOR_CHOICES[0].value;
      setUserData({
        ...user,
        birthdate: user.birthdate ? parseISO(user.birthdate) : null,
        email: user.email ?? '',
        phone_number: user.phone_number ?? '',
        color: validColor,
      });
    } catch (err) {
      setError('Failed to fetch user data');
    } finally {
      setLoadingUser(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setUserData((prev) => ({ ...prev, birthdate: date }));
  };

  const handleUpdateUser = async () => {
    const dataToSend = {
      ...userData,
      birthdate: userData.birthdate ? format(userData.birthdate, 'yyyy-MM-dd') : null,
    };
    try {
      await apiRequest({
        url: `${API_BASE}user/`,
        method: 'PUT',
        data: dataToSend,
      });
      setSuccess('User updated successfully');
      setEditMode(false);
      fetchUserData();
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const handleAddProfile = async () => {
    if (!newProfile.image) return;
    const formData = new FormData();
    formData.append('image', newProfile.image, 'profile.jpg');
    formData.append('order', newProfile.order);
    try {
      await apiRequest({
        url: `${API_BASE}profile/set/`,
        method: 'POST',
        data: formData,
      });
      setSuccess('Profile added');
      setNewProfile({ image: null, order: 0 });
      setPreviewUrl(null);
      fetchProfiles();
    } catch (err) {
      setError('Failed to add profile');
    }
  };

  const handleDeleteProfile = async (id) => {
    try {
      await apiRequest({
        url: `${API_BASE}profile/delete/`,
        method: 'POST',
        data: { id },
      });
      setSuccess('Profile deleted');
      fetchProfiles();
    } catch (err) {
      setError('Failed to delete profile');
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const newProfiles = Array.from(profiles);
    const [reorderedItem] = newProfiles.splice(result.source.index, 1);
    newProfiles.splice(result.destination.index, 0, reorderedItem);

    const updatedProfiles = newProfiles.map((profile, index) => ({
      ...profile,
      order: index,
    }));

    setProfiles(updatedProfiles);

    const orderDict = updatedProfiles.reduce((acc, p) => ({ ...acc, [p.id]: p.order }), {});
    handleOrderProfiles(orderDict);
  };

  const handleOrderProfiles = async (newOrder) => {
    try {
      await apiRequest({
        url: `${API_BASE}profile/order/`,
        method: 'POST',
        data: { order: newOrder },
      });
      setSuccess('Order updated');
    } catch (err) {
      setError('Failed to update order');
      fetchProfiles();
    }
  };

  const fetchPasswordStatus = async () => {
    setPasswordStatusLoading(true);
    try {
      const response = await apiRequest({ url: `${API_BASE}password-status/`, method: 'GET' });
      setHasPassword(Boolean(response.data?.has_password));
    } catch (err) {
      setError('Failed to verify password configuration');
      setHasPassword(false);
    } finally {
      setPasswordStatusLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeletePasswordChange = (e) => {
    const { name, value } = e.target;
    setDeletePasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSetPassword = async () => {
    if (passwordData.new_password !== passwordData.new_confirm_password) {
      setError('New password and confirmation do not match.');
      return;
    }
    setPasswordOperationLoading(true);
    try {
      await apiRequest({
        url: `${API_BASE}set-password/`,
        method: 'POST',
        data: {
          new_password: passwordData.new_password,
          new_confirm_password: passwordData.new_confirm_password,
        },
      });
      setSuccess('Password has been set.');
      setPasswordDialogOpen(false);
      setPasswordData({ password: '', confirm_password: '', new_password: '', new_confirm_password: '' });
      await fetchPasswordStatus();
    } catch (err) {
      console.error('handleSetPassword error:', err);
      setError(err.response?.data?.errors || err.response?.data?.message || 'Failed to set password');
    } finally {
      setPasswordOperationLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.password !== passwordData.confirm_password) {
      setError('Current password confirmation does not match.');
      return;
    }
    if (passwordData.new_password !== passwordData.new_confirm_password) {
      setError('New password and confirmation do not match.');
      return;
    }
    setPasswordOperationLoading(true);
    try {
      await apiRequest({
        url: `${API_BASE}change-password/`,
        method: 'POST',
        data: {
          current_password: passwordData.password,
          new_password: passwordData.new_password,
          new_confirm_password: passwordData.new_confirm_password,
        },
      });
      setSuccess('Password changed successfully.');
      setPasswordDialogOpen(false);
      setPasswordData({ password: '', confirm_password: '', new_password: '', new_confirm_password: '' });
      await fetchPasswordStatus();
    } catch (err) {
      console.error('handleChangePassword error:', err);
      setError(err.response?.data?.errors || err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordOperationLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    if (deletePasswordData.password !== deletePasswordData.confirm_password) {
      setError('Password confirmation does not match.');
      return;
    }
    setPasswordOperationLoading(true);
    try {
      await apiRequest({
        url: `${API_BASE}remove-password/`,
        method: 'DELETE',
        data: {
          current_password: deletePasswordData.password,
        },
      });
      setSuccess('Password removed successfully.');
      setDeletePasswordDialogOpen(false);
      setDeletePasswordData({ password: '', confirm_password: '' });
      await fetchPasswordStatus();
    } catch (err) {
      console.error('handleRemovePassword error:', err);
      setError(err.response?.data?.errors || err.response?.data?.message || 'Failed to remove password');
    } finally {
      setPasswordOperationLoading(false);
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setNewProfile((prev) => ({ ...prev, image: file }));
      setPreviewUrl(URL.createObjectURL(file));
      setZoom(1);
      setRotation(0);
      setCircularCrop(false);
    }
  };

  const handleApplyEdit = () => {
    if (editorRef.current) {
      editorRef.current.getImageScaledToCanvas().toBlob(
        (blob) => {
          if (blob) {
            setNewProfile((prev) => ({ ...prev, image: blob }));
            setPreviewUrl(URL.createObjectURL(blob));
          }
        },
        'image/jpeg',
        0.95
      );
    }
    setEditorOpen(false);
  };

  const handleNewOrderChange = (e) => {
    setNewProfile((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }));
  };

  if (loadingUser || loadingProfiles) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 5 }} />;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md">
        <Paper elevation={4} sx={{ my: 4, p: 4, borderRadius: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Profile
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'medium' }}>
            User Information
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Username"
                name="username"
                value={userData.username}
                onChange={handleInputChange}
                fullWidth
                disabled={!editMode}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Email"
                name="email"
                value={userData.email}
                onChange={handleInputChange}
                fullWidth
                disabled={!editMode || userData.email_verified}
                helperText={userData.email_verified ? 'Verified' : ''}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Phone Number"
                name="phone_number"
                value={userData.phone_number}
                onChange={handleInputChange}
                fullWidth
                disabled={!editMode || userData.phone_number_verified}
                helperText={userData.phone_number_verified ? 'Verified' : ''}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Birthdate"
                value={userData.birthdate}
                onChange={handleDateChange}
                maxDate={new Date()}
                disabled={!editMode}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    variant: 'outlined',
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Theme</InputLabel>
                <Select
                  name="theme"
                  value={userData.theme}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  label="Theme"
                >
                  {THEME_CHOICES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Color</InputLabel>
                <Select
                  name="color"
                  value={userData.color}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  label="Color"
                >
                  {COLOR_CHOICES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-start' }}>
            {editMode ? (
              <>
                <Button variant="contained" color="primary" onClick={handleUpdateUser} sx={{ mr: 2 }}>
                  Save Changes
                </Button>
                <Button variant="outlined" color="secondary" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="contained" color="primary" onClick={() => setEditMode(true)}>
                Edit Profile
              </Button>
            )}
          </Box>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'medium' }}>
            Profile Images (Drag to reorder)
          </Typography>

          <DragDropContext onDragEnd={handleDragEnd}>
            <StrictModeDroppable droppableId="profiles" direction="horizontal">
              {(provided) => (
                <Grid
                  container
                  spacing={3}
                  sx={{ mt: 2 }}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {profiles
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((profile, index) => (
                      <Draggable key={profile.id} draggableId={profile.id.toString()} index={index}>
                        {(provided) => (
                          <Grid
                            size={{ xs: 12, sm: 4, md: 3 }}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            sx={{ cursor: 'grab' }}
                          >
                            <Paper
                              elevation={2}
                              sx={{
                                p: 1,
                                textAlign: 'center',
                                borderRadius: 2,
                                position: 'relative',
                              }}
                            >
                              <Avatar
                                src={profile.image_url}
                                alt={`Profile ${profile.order}`}
                                sx={{
                                  width: 120,
                                  height: 120,
                                  mx: 'auto',
                                  border: '2px solid',
                                  borderColor: 'primary.main',
                                }}
                              />
                              <IconButton
                                color="error"
                                size="small"
                                sx={{ position: 'absolute', top: 8, right: 8 }}
                                onClick={() => handleDeleteProfile(profile.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                Order: {profile.order}
                              </Typography>
                            </Paper>
                          </Grid>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </Grid>
              )}
            </StrictModeDroppable>
          </DragDropContext>

          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {previewUrl && (
              <Avatar
                src={previewUrl}
                sx={{ width: 60, height: 60, mr: 2, border: '1px solid grey' }}
              />
            )}
            <Button variant="outlined" component="label" startIcon={<AddPhotoAlternateIcon />} sx={{ mr: 2 }}>
              Select Image
              <input type="file" hidden accept="image/*" onChange={handleImageChange} />
            </Button>
            {previewUrl && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setEditorOpen(true)}
                sx={{ mr: 2 }}
              >
                Edit Image
              </Button>
            )}
            <TextField
              label="Order"
              type="number"
              value={newProfile.order}
              onChange={handleNewOrderChange}
              sx={{ mr: 2, width: 120 }}
              variant="outlined"
              size="small"
            />
            <Button variant="contained" color="primary" onClick={handleAddProfile} disabled={!newProfile.image}>
              Add Profile
            </Button>
          </Box>

          <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Profile Image</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <ReactAvatarEditor
                  ref={editorRef}
                  image={previewUrl}
                  width={250}
                  height={250}
                  border={50}
                  borderRadius={circularCrop ? 125 : 0}
                  color={[255, 255, 255, 0.6]}
                  scale={zoom}
                  rotate={rotation}
                />
              </Box>
              <Typography variant="body2">Zoom</Typography>
              <Slider
                value={zoom}
                onChange={(e, v) => setZoom(v)}
                min={1}
                max={2}
                step={0.01}
                aria-labelledby="zoom-slider"
              />
              <Typography variant="body2">Rotation</Typography>
              <Slider
                value={rotation}
                onChange={(e, v) => setRotation(v)}
                min={-180}
                max={180}
                step={1}
                aria-labelledby="rotation-slider"
              />
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Switch
                  checked={circularCrop}
                  onChange={(e) => setCircularCrop(e.target.checked)}
                />
                <Typography variant="body2">Circular Crop</Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditorOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={handleApplyEdit} color="primary" variant="contained">
                Apply
              </Button>
            </DialogActions>
          </Dialog>

          <Divider sx={{ my: 4 }} />

          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'medium' }}>
            Password Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {passwordStatusLoading
              ? 'Checking password configuration...'
              : hasPassword
                ? 'A password is configured. You can change or remove it.'
                : 'No password is configured. Set a password to secure your account.'}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            {hasPassword ? (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setPasswordDialogOpen(true)}
                  sx={{ mr: 2 }}
                >
                  Change Password
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setDeletePasswordDialogOpen(true)}
                >
                  Remove Password
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setPasswordDialogOpen(true)}
              >
                Set Password
              </Button>
            )}
          </Box>

          <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{hasPassword ? 'Change Password' : 'Set Password'}</DialogTitle>
            <DialogContent>
              {hasPassword && (
                <>
                  <TextField
                    label="Current Password"
                    name="password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.password}
                    onChange={handlePasswordChange}
                    fullWidth
                    variant="outlined"
                    sx={{ mb: 2 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton edge="end" onClick={() => setShowCurrentPassword((prev) => !prev)}>
                            {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Confirm Current Password"
                    name="confirm_password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    fullWidth
                    variant="outlined"
                    sx={{ mb: 2 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton edge="end" onClick={() => setShowCurrentPassword((prev) => !prev)}>
                            {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </>
              )}
              <TextField
                label="New Password"
                name="new_password"
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                fullWidth
                variant="outlined"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={() => setShowNewPassword((prev) => !prev)}>
                        {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirm New Password"
                name="new_confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordData.new_confirm_password}
                onChange={handlePasswordChange}
                fullWidth
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                        {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPasswordDialogOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={hasPassword ? handleChangePassword : handleSetPassword} color="primary" variant="contained" disabled={passwordOperationLoading}>
                {hasPassword ? 'Save Changes' : 'Set Password'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={deletePasswordDialogOpen} onClose={() => setDeletePasswordDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Remove Password</DialogTitle>
            <DialogContent>
              <TextField
                label="Current Password"
                name="password"
                type={showDeletePassword ? 'text' : 'password'}
                value={deletePasswordData.password}
                onChange={handleDeletePasswordChange}
                fullWidth
                variant="outlined"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton edge="end" onClick={() => setShowDeletePassword((prev) => !prev)}>
                        {showDeletePassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirm Current Password"
                name="confirm_password"
                type={showDeletePassword ? 'text' : 'password'}
                value={deletePasswordData.confirm_password}
                onChange={handleDeletePasswordChange}
                fullWidth
                variant="outlined"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeletePasswordDialogOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={handleRemovePassword} color="error" variant="contained" disabled={passwordOperationLoading}>
                Remove Password
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default Profile;