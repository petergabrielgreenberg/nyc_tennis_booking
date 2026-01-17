// src/App.js - Complete Supabase Tennis Booking System
// Copy this ENTIRE file and paste it into your src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Users, Settings, LogOut, Plus } from 'lucide-react';
import { supabase } from './supabaseClient';

const TennisBookingSystem = () => {
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [courts, setCourts] = useState([]);
  const [hours, setHours] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('clubs');
  const [selectedClub, setSelectedClub] = useState(null);
  const [bookingModal, setBookingModal] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [newCourt, setNewCourt] = useState({ name: '', clubId: '', surface: '' });
  const [newClub, setNewClub] = useState({ name: '', borough: '', password: '' });
  const [selectedClubForHours, setSelectedClubForHours] = useState(null);
  const [clubHours, setClubHours] = useState({ startHour: 8, endHour: 20 });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginData, setAdminLoginData] = useState({ clubId: '', password: '' });
  const [editingClub, setEditingClub] = useState(null);
  const [editingCourt, setEditingCourt] = useState(null);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [superAdminLogin, setSuperAdminLogin] = useState({ email: '', password: '' });

  const TODAY = new Date().toISOString().split('T')[0];
  const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

  const updateUrlParams = useCallback((newView, clubId) => {
    const url = new URL(window.location);
    if (newView === 'player') {
      url.searchParams.set('view', 'player');
      if (clubId) {
        url.searchParams.set('club', clubId.toString());
      } else {
        url.searchParams.delete('club');
      }
    } else {
      url.searchParams.delete('view');
      url.searchParams.delete('club');
    }
    window.history.replaceState({}, '', url);
  }, []);

  const getUrlParams = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const clubParam = params.get('club');
    return {
      view: viewParam,
      clubId: clubParam ? parseInt(clubParam, 10) : null
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const { data: clubsData } = await supabase.from('clubs').select('*');
      setClubs(clubsData || []);

      const { data: courtsData } = await supabase.from('courts').select('*');
      setCourts(courtsData || []);

      const { data: hoursData } = await supabase.from('court_hours').select('*');
      setHours(hoursData || []);

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', TODAY)
        .eq('status', 'confirmed');
      setBookings(bookingsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [TODAY]);

  const loadUserRole = useCallback(async (userId) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role, club_id')
      .eq('user_id', userId)
      .single();

    if (data) {
      if (data.role === 'super_admin') {
        setView('super');
        setCurrentUser({ type: 'super', name: 'Super Admin', userId });
      } else if (data.role === 'club_admin') {
        const { data: clubData } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', data.club_id)
          .single();

        setView('admin');
        setCurrentUser({
          type: 'admin',
          name: `${clubData?.name} Admin`,
          clubId: data.club_id,
          userId
        });
        setSelectedClub(data.club_id);
      }
    }
    setLoading(false);
  }, []);

  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserRole(session.user.id);
    } else {
      const urlParams = getUrlParams();
      if (urlParams.view === 'player') {
        setView('player');
        setCurrentUser({ type: 'player', name: 'Player' });
        if (urlParams.clubId) {
          setSelectedClub(urlParams.clubId);
        }
        await loadData();
      }
      setLoading(false);
    }
  }, [loadUserRole, getUrlParams, loadData]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (view !== 'login') {
      loadData();
    }
  }, [view, loadData]);

  const handleSuperAdminLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: superAdminLogin.email,
        password: superAdminLogin.password
      });

      if (error) {
        alert('Invalid credentials');
        return;
      }

      await loadUserRole(data.user.id);
      setShowSuperAdminModal(false);
      setSuperAdminLogin({ email: '', password: '' });
    } catch (error) {
      alert('Login failed');
    }
  };

  const handleClubAdminLogin = async () => {
    if (!adminLoginData.clubId) {
      alert('Please select a club');
      return;
    }

    try {
      const { data: passwordData } = await supabase
        .from('club_passwords')
        .select('password')
        .eq('club_id', adminLoginData.clubId)
        .single();

      if (!passwordData || passwordData.password !== adminLoginData.password) {
        alert('Incorrect password');
        return;
      }

      const { data: clubData } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', adminLoginData.clubId)
        .single();

      setView('admin');
      setCurrentUser({
        type: 'admin',
        name: `${clubData?.name} Admin`,
        clubId: parseInt(adminLoginData.clubId)
      });
      setSelectedClub(parseInt(adminLoginData.clubId));
      setShowAdminLoginModal(false);
      setAdminLoginData({ clubId: '', password: '' });
      loadData();
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleLogout = async () => {
    if (currentUser?.type === 'super') {
      await supabase.auth.signOut();
    }
    setView('login');
    setCurrentUser(null);
    setSelectedClub(null);
    updateUrlParams('login', null);
  };

  const handleLogin = (type) => {
    if (type === 'super') {
      setShowSuperAdminModal(true);
    } else if (type === 'admin') {
      setShowAdminLoginModal(true);
      loadData();
    } else if (type === 'player') {
      setView('player');
      setCurrentUser({ type: 'player', name: 'Player' });
      updateUrlParams('player', null);
      loadData();
    }
  };

  const getCourtAvailability = (clubId) => {
    const clubCourts = courts.filter(c => c.club_id === clubId && c.status === 'active');
    const availableHours = [...new Set(hours.filter(h => 
      clubCourts.some(c => c.id === h.court_id)
    ).map(h => h.hour))].sort((a, b) => a - b);

    const availability = {};
    availableHours.forEach(hour => {
      availability[hour] = clubCourts.map(court => {
        const booking = bookings.find(b => 
          b.court_id === court.id && 
          b.date === TODAY && 
          b.hour === hour &&
          b.status === 'confirmed'
        );
        return {
          court,
          hour,
          booking: booking || null,
          available: !booking
        };
      });
    });

    return availability;
  };

  const handleCreateBooking = async (courtId, hour, playerName, memberId) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .insert({
          court_id: courtId,
          player_name: playerName,
          member_id: memberId,
          date: TODAY,
          hour: hour,
          status: 'confirmed'
        });

      if (error) throw error;
      
      await loadData();
      setBookingModal(null);
      setEditMode(false);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking');
    }
  };

  const handleUpdateBooking = async (bookingId, playerName, memberId) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          player_name: playerName,
          member_id: memberId
        })
        .eq('id', bookingId);

      if (error) throw error;
      
      await loadData();
      setBookingModal(null);
      setEditMode(false);
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      
      await loadData();
      setBookingModal(null);
      setEditMode(false);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    }
  };

  const handleAddClub = async () => {
    if (!newClub.name || !newClub.borough || !newClub.password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: newClub.name,
          borough: newClub.borough
        })
        .select()
        .single();

      if (clubError) throw clubError;

      await supabase
        .from('club_passwords')
        .insert({
          club_id: clubData.id,
          password: newClub.password
        });

      await loadData();
      setNewClub({ name: '', borough: '', password: '' });
    } catch (error) {
      console.error('Error adding club:', error);
      alert('Failed to add club');
    }
  };

  const handleUpdateClub = async () => {
    if (!editingClub.name || !editingClub.borough) {
      alert('Please fill in club name and borough');
      return;
    }

    try {
      await supabase
        .from('clubs')
        .update({
          name: editingClub.name,
          borough: editingClub.borough
        })
        .eq('id', editingClub.id);

      if (editingClub.password) {
        await supabase
          .from('club_passwords')
          .update({ password: editingClub.password })
          .eq('club_id', editingClub.id);
      }

      await loadData();
      setEditingClub(null);
    } catch (error) {
      console.error('Error updating club:', error);
      alert('Failed to update club');
    }
  };

  const getSortedClubs = () => {
    return [...clubs].sort((a, b) => {
      const boroughIndexA = BOROUGHS.indexOf(a.borough);
      const boroughIndexB = BOROUGHS.indexOf(b.borough);
      
      if (boroughIndexA !== boroughIndexB) {
        return boroughIndexA - boroughIndexB;
      }
      
      return a.name.localeCompare(b.name);
    });
  };

  const handleAddCourt = async () => {
    if (!newCourt.name || !newCourt.clubId || !newCourt.surface) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { data: courtData, error } = await supabase
        .from('courts')
        .insert({
          name: newCourt.name,
          club_id: parseInt(newCourt.clubId),
          surface: newCourt.surface,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      const hoursToAdd = [];
      for (let hour = 8; hour <= 20; hour++) {
        hoursToAdd.push({
          court_id: courtData.id,
          hour
        });
      }
      
      await supabase.from('court_hours').insert(hoursToAdd);

      await loadData();
      setNewCourt({ name: '', clubId: '', surface: '' });
    } catch (error) {
      console.error('Error adding court:', error);
      alert('Failed to add court');
    }
  };

  const toggleCourtStatus = async (courtId) => {
    try {
      const court = courts.find(c => c.id === courtId);
      const newStatus = court.status === 'active' ? 'inactive' : 'active';

      await supabase
        .from('courts')
        .update({ status: newStatus })
        .eq('id', courtId);

      await loadData();
    } catch (error) {
      console.error('Error toggling court status:', error);
      alert('Failed to update court status');
    }
  };

  const handleUpdateCourt = async () => {
    if (!editingCourt.name || !editingCourt.surface) {
      alert('Please fill in court name and surface');
      return;
    }

    try {
      await supabase
        .from('courts')
        .update({
          name: editingCourt.name,
          surface: editingCourt.surface
        })
        .eq('id', editingCourt.id);

      await loadData();
      setEditingCourt(null);
    } catch (error) {
      console.error('Error updating court:', error);
      alert('Failed to update court');
    }
  };

  const handleDeleteCourt = async (courtId) => {
    if (!window.confirm('Are you sure you want to delete this court? All associated bookings and hours will also be deleted.')) {
      return;
    }

    try {
      await supabase
        .from('courts')
        .delete()
        .eq('id', courtId);

      await loadData();
      setEditingCourt(null);
    } catch (error) {
      console.error('Error deleting court:', error);
      alert('Failed to delete court');
    }
  };

  const handleUpdateClubHours = async (clubId, startHour, endHour) => {
    if (startHour >= endHour) {
      alert('Closing time must be after opening time');
      return;
    }

    try {
      const clubCourts = courts.filter(c => c.club_id === clubId);
      
      for (const court of clubCourts) {
        await supabase
          .from('court_hours')
          .delete()
          .eq('court_id', court.id);
      }

      const newHours = [];
      clubCourts.forEach(court => {
        for (let hour = startHour; hour < endHour; hour++) {
          newHours.push({
            court_id: court.id,
            hour
          });
        }
      });

      await supabase.from('court_hours').insert(newHours);

      await loadData();
      setSelectedClubForHours(null);
      alert('Hours updated successfully!');
    } catch (error) {
      console.error('Error updating hours:', error);
      alert('Failed to update hours');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 relative">
        <div className="max-w-md mx-auto pt-20">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
                <Calendar className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Tennis Court Availability</h1>
              <p className="text-gray-600">NYC Department of Parks & Recreation</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => handleLogin('player')}
                className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2"
              >
                <User className="w-5 h-5" />
                Player View
              </button>

              <button
                onClick={() => handleLogin('admin')}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-semibold hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                Club Admin Login
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleLogin('super')}
          className="fixed bottom-4 right-4 w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded-lg transition flex items-center justify-center"
        >
          <Settings className="w-6 h-6 text-gray-600" />
        </button>

        {showSuperAdminModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">Settings Login</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={superAdminLogin.email}
                    onChange={(e) => setSuperAdminLogin({...superAdminLogin, email: e.target.value})}
                    placeholder="Enter email"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={superAdminLogin.password}
                    onChange={(e) => setSuperAdminLogin({...superAdminLogin, password: e.target.value})}
                    onKeyDown={(e) => e.key === 'Enter' && handleSuperAdminLogin()}
                    placeholder="Enter password"
                    className="w-full p-3 border rounded-lg"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSuperAdminLogin}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setShowSuperAdminModal(false);
                      setSuperAdminLogin({ email: '', password: '' });
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">Club Admin Login</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Club</label>
                  <select
                    value={adminLoginData.clubId}
                    onChange={(e) => setAdminLoginData({...adminLoginData, clubId: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Choose a club</option>
                    {getSortedClubs().map(club => (
                      <option key={club.id} value={club.id}>
                        {club.name} ({club.borough})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={adminLoginData.password}
                    onChange={(e) => setAdminLoginData({...adminLoginData, password: e.target.value})}
                    placeholder="Enter password"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleClubAdminLogin}
                    className="flex-1 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setShowAdminLoginModal(false);
                      setAdminLoginData({ clubId: '', password: '' });
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'player') {
    const availability = selectedClub ? getCourtAvailability(selectedClub) : {};
    const club = clubs.find(c => c.id === selectedClub);

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Player View</h1>
              <p className="text-sm text-green-100">Today: {new Date().toLocaleDateString()}</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Select Club</h2>
            <select
              value={selectedClub || ''}
              onChange={(e) => {
                const clubId = parseInt(e.target.value);
                setSelectedClub(clubId);
                updateUrlParams('player', clubId || null);
              }}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg"
            >
              <option value="">Choose a club</option>
              {getSortedClubs().map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.borough})
                </option>
              ))}
            </select>
          </div>

          {selectedClub && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Court Availability - {club?.name}
              </h2>
              <div className="space-y-6">
                {Object.keys(availability).map(hour => (
                  <div key={hour}>
                    <h3 className="text-md font-semibold text-gray-700 mb-3">
                      {hour}:00 - {parseInt(hour) + 1}:00
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {availability[hour].map((slot, idx) => (
                        <button
                          key={idx}
                          className={`p-3 rounded-lg font-medium text-sm ${
                            slot.available
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          }`}
                          disabled
                        >
                          {slot.court.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    const availability = getCourtAvailability(currentUser.clubId);
    const club = clubs.find(c => c.id === currentUser.clubId);

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">{currentUser.name}</h1>
              <p className="text-sm text-green-100">{club?.name} - Today: {new Date().toLocaleDateString()}</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Court Bookings - {club?.name}
            </h2>
            <div className="space-y-6">
              {Object.keys(availability).map(hour => (
                <div key={hour}>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">
                    {hour}:00 - {parseInt(hour) + 1}:00
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {availability[hour].map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setBookingModal(slot)}
                        className={`p-3 rounded-lg font-medium text-sm transition ${
                          slot.available
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-400 text-white hover:bg-gray-500'
                        }`}
                      >
                        {slot.available 
                          ? slot.court.name 
                          : `${slot.court.name} | ${slot.booking.player_name}`
                        }
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {bookingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">
                {bookingModal.court.name} - {bookingModal.hour}:00
              </h3>
              
              {bookingModal.available ? (
                <div className="space-y-4">
                  <p className="text-gray-600">Create a new reservation</p>
                  <input
                    id="playerName"
                    placeholder="Player Name"
                    className="w-full p-3 border rounded-lg"
                  />
                  <input
                    id="memberId"
                    placeholder="Member ID"
                    className="w-full p-3 border rounded-lg"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const name = document.getElementById('playerName').value;
                        const memberId = document.getElementById('memberId').value;
                        if (name && memberId) {
                          handleCreateBooking(bookingModal.court.id, bookingModal.hour, name, memberId);
                        } else {
                          alert('Please fill in all fields');
                        }
                      }}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      Create Booking
                    </button>
                    <button
                      onClick={() => {
                        setBookingModal(null);
                        setEditMode(false);
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {editMode ? (
                    <>
                      <p className="text-gray-600 mb-3">Edit reservation details</p>
                      <input
                        id="editPlayerName"
                        defaultValue={bookingModal.booking.player_name}
                        placeholder="Player Name"
                        className="w-full p-3 border rounded-lg"
                      />
                      <input
                        id="editMemberId"
                        defaultValue={bookingModal.booking.member_id}
                        placeholder="Member ID"
                        className="w-full p-3 border rounded-lg"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            const name = document.getElementById('editPlayerName').value;
                            const memberId = document.getElementById('editMemberId').value;
                            if (name && memberId) {
                              handleUpdateBooking(bookingModal.booking.id, name, memberId);
                            } else {
                              alert('Please fill in all fields');
                            }
                          }}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditMode(false)}
                          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Player Name</p>
                        <p className="font-semibold text-gray-800">{bookingModal.booking.player_name}</p>
                        <p className="text-sm text-gray-600 mt-2">Member ID</p>
                        <p className="font-semibold text-gray-800">{bookingModal.booking.member_id}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditMode(true)}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                          Edit Booking
                        </button>
                        <button
                          onClick={() => handleCancelBooking(bookingModal.booking.id)}
                          className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
                        >
                          Cancel Booking
                        </button>
                        <button
                          onClick={() => {
                            setBookingModal(null);
                            setEditMode(false);
                          }}
                          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (view === 'super') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">System Configuration</h1>
            <button onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white border-b sticky top-16 z-10">
          <div className="max-w-6xl mx-auto flex overflow-x-auto">
            {['clubs', 'courts', 'hours'].map(tab => (
              <button
                key={tab}
                onClick={() => setAdminTab(tab)}
                className={`px-6 py-4 font-medium capitalize whitespace-nowrap ${
                  adminTab === tab
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4">
          {adminTab === 'clubs' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Add New Club</h2>
                <div className="space-y-3">
                  <input
                    value={newClub.name}
                    onChange={(e) => setNewClub({...newClub, name: e.target.value})}
                    placeholder="Club Name"
                    className="w-full p-3 border rounded-lg"
                  />
                  <select
                    value={newClub.borough}
                    onChange={(e) => setNewClub({...newClub, borough: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Select Borough</option>
                    {BOROUGHS.map(borough => (
                      <option key={borough} value={borough}>{borough}</option>
                    ))}
                  </select>
                  <input
                    type="password"
                    value={newClub.password}
                    onChange={(e) => setNewClub({...newClub, password: e.target.value})}
                    placeholder="Admin Password for this club"
                    className="w-full p-3 border rounded-lg"
                  />
                  <button
                    onClick={handleAddClub}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    <Plus className="w-5 h-5 inline mr-2" />
                    Add Club
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">All Clubs</h2>
                <div className="space-y-3">
                  {getSortedClubs().map(club => (
                    <div 
                      key={club.id} 
                      onClick={() => setEditingClub({...club, password: ''})}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <p className="font-semibold text-gray-800">{club.name}</p>
                      <p className="text-sm text-gray-600">{club.borough}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'courts' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Add New Court</h2>
                <div className="space-y-3">
                  <select
                    value={newCourt.clubId}
                    onChange={(e) => setNewCourt({...newCourt, clubId: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Select Club</option>
                    {getSortedClubs().map(club => (
                      <option key={club.id} value={club.id}>{club.name} ({club.borough})</option>
                    ))}
                  </select>
                  <input
                    value={newCourt.name}
                    onChange={(e) => setNewCourt({...newCourt, name: e.target.value})}
                    placeholder="Court Name"
                    className="w-full p-3 border rounded-lg"
                  />
                  <select
                    value={newCourt.surface}
                    onChange={(e) => setNewCourt({...newCourt, surface: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Select Surface</option>
                    <option value="Hard">Hard</option>
                    <option value="Clay">Clay</option>
                    <option value="Grass">Grass</option>
                  </select>
                  <button
                    onClick={handleAddCourt}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    <Plus className="w-5 h-5 inline mr-2" />
                    Add Court
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Manage Courts</h2>
                {getSortedClubs().map(club => {
                  const clubCourts = courts.filter(c => c.club_id === club.id);
                  return (
                    <div key={club.id} className="mb-6">
                      <h3 className="font-semibold text-gray-700 mb-3">{club.name} ({club.borough})</h3>
                      <div className="space-y-2">
                        {clubCourts.map(court => (
                          <div
                            key={court.id}
                            onClick={() => setEditingCourt({...court})}
                            className="border rounded-lg p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                          >
                            <div>
                              <p className="font-medium text-gray-800">{court.name}</p>
                              <p className="text-sm text-gray-500">{court.surface}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCourtStatus(court.id);
                              }}
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                court.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {court.status === 'active' ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {adminTab === 'hours' && (
            <div className="space-y-4">
              {!selectedClubForHours ? (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold mb-4">Select Club to Edit Hours</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {getSortedClubs().map(club => {
                      const clubCourts = courts.filter(c => c.club_id === club.id);
                      const courtHours = hours.filter(h => clubCourts.some(c => c.id === h.court_id));
                      const minHour = courtHours.length > 0 ? Math.min(...courtHours.map(h => h.hour)) : 8;
                      const maxHour = courtHours.length > 0 ? Math.max(...courtHours.map(h => h.hour)) : 20;
                      
                      return (
                        <button
                          key={club.id}
                          onClick={() => {
                            setSelectedClubForHours(club.id);
                            setClubHours({ startHour: minHour, endHour: maxHour + 1 });
                          }}
                          className="border-2 border-gray-200 rounded-lg p-6 hover:border-purple-400 hover:bg-purple-50 transition text-left"
                        >
                          <p className="font-semibold text-gray-800 text-lg mb-2">{club.name}</p>
                          <p className="text-sm text-gray-600">{club.borough}</p>
                          <p className="text-sm text-gray-500 mt-2">
                            Current Hours: {minHour}:00 - {maxHour + 1}:00
                          </p>
                          <p className="text-sm text-gray-500">
                            {clubCourts.length} court{clubCourts.length !== 1 ? 's' : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">
                      Edit Hours - {clubs.find(c => c.id === selectedClubForHours)?.name}
                    </h2>
                    <button
                      onClick={() => setSelectedClubForHours(null)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Opening Time
                      </label>
                      <select
                        value={clubHours.startHour}
                        onChange={(e) => setClubHours({...clubHours, startHour: parseInt(e.target.value)})}
                        className="w-full p-3 border rounded-lg"
                      >
                        {Array.from({length: 24}, (_, i) => i).map(hour => (
                          <option key={hour} value={hour}>
                            {hour}:00 ({hour < 12 ? hour === 0 ? '12 AM' : hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM'})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Closing Time
                      </label>
                      <select
                        value={clubHours.endHour}
                        onChange={(e) => setClubHours({...clubHours, endHour: parseInt(e.target.value)})}
                        className="w-full p-3 border rounded-lg"
                      >
                        {Array.from({length: 24}, (_, i) => i).map(hour => (
                          <option key={hour} value={hour}>
                            {hour}:00 ({hour < 12 ? hour === 0 ? '12 AM' : hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM'})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">Note:</span> Courts will be available for booking from {clubHours.startHour}:00, with the last booking ending at {clubHours.endHour}:00.
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleUpdateClubHours(selectedClubForHours, clubHours.startHour, clubHours.endHour)}
                        className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                      >
                        Save Hours
                      </button>
                      <button
                        onClick={() => setSelectedClubForHours(null)}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {editingClub && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">Edit Club</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Club Name
                  </label>
                  <input
                    value={editingClub.name}
                    onChange={(e) => setEditingClub({...editingClub, name: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Borough
                  </label>
                  <select
                    value={editingClub.borough}
                    onChange={(e) => setEditingClub({...editingClub, borough: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Select Borough</option>
                    {BOROUGHS.map(borough => (
                      <option key={borough} value={borough}>{borough}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    value={editingClub.password || ''}
                    onChange={(e) => setEditingClub({...editingClub, password: e.target.value})}
                    placeholder="Enter new password (leave blank to keep current)"
                    className="w-full p-3 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to keep the current password</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleUpdateClub}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingClub(null)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingCourt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">Edit Court</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Court Name
                  </label>
                  <input
                    value={editingCourt.name}
                    onChange={(e) => setEditingCourt({...editingCourt, name: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Surface Type
                  </label>
                  <select
                    value={editingCourt.surface}
                    onChange={(e) => setEditingCourt({...editingCourt, surface: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  >
                    <option value="">Select Surface</option>
                    <option value="Hard">Hard</option>
                    <option value="Clay">Clay</option>
                    <option value="Grass">Grass</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateCourt}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => handleDeleteCourt(editingCourt.id)}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
                  >
                    Delete Court
                  </button>
                  <button
                    onClick={() => setEditingCourt(null)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default TennisBookingSystem;