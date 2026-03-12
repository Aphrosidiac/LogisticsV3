'use client';

import { useEffect, useState } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  AlertCircle,
  Star,
  Calendar,
} from 'lucide-react';
import {
  getAllZones,
  getDistrictsByZone,
  createZone,
  updateZone,
  deleteZone,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  getZonesWithDistricts,
  getAllSpecialZones,
  createSpecialZone,
  updateSpecialZone,
  deleteSpecialZone,
} from '@/lib/db-zones';
import type { Zone, District, ZoneWithDistricts, SpecialZone } from '@/types';
import Modal from '@/components/Modal';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

type DeleteConfirm =
  | { type: 'zone'; id: string; name: string; extra?: string }
  | { type: 'district'; id: string; name: string };

export default function ZonesPage() {
  const [zones, setZones] = useState<ZoneWithDistricts[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Modal states
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [selectedZoneForDistrict, setSelectedZoneForDistrict] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Special zones state
  const [specialZones, setSpecialZones] = useState<SpecialZone[]>([]);
  const [showSpecialZoneModal, setShowSpecialZoneModal] = useState(false);
  const [editingSpecialZone, setEditingSpecialZone] = useState<SpecialZone | null>(null);
  const [specialZoneForm, setSpecialZoneForm] = useState({
    name: '',
    description: '',
    active_days: [] as number[],
    is_active: true,
  });
  const [specialZoneDeleteConfirm, setSpecialZoneDeleteConfirm] = useState<string | null>(null);
  const [deletingSpecialZone, setDeletingSpecialZone] = useState(false);

  // Form states
  const [zoneForm, setZoneForm] = useState({
    name: '',
    description: '',
    is_active: true,
    display_order: 0,
  });

  const [districtForm, setDistrictForm] = useState({
    name: '',
    description: '',
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    loadZones();
    loadSpecialZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getZonesWithDistricts(false);
      setZones(data);
    } catch (error) {
      // silently fail — empty list is handled in UI
    } finally {
      setLoading(false);
    }
  };

  const loadSpecialZones = async () => {
    try {
      const data = await getAllSpecialZones();
      setSpecialZones(data);
    } catch {
      // silently fail
    }
  };

  const toggleZoneExpansion = (zoneId: string) => {
    const newExpanded = new Set(expandedZones);
    if (newExpanded.has(zoneId)) {
      newExpanded.delete(zoneId);
    } else {
      newExpanded.add(zoneId);
    }
    setExpandedZones(newExpanded);
  };

  // Zone CRUD handlers
  const openAddZoneModal = () => {
    setEditingZone(null);
    setFormError('');
    setZoneForm({ name: '', description: '', is_active: true, display_order: 0 });
    setShowZoneModal(true);
  };

  const openEditZoneModal = (zone: Zone) => {
    setEditingZone(zone);
    setFormError('');
    setZoneForm({
      name: zone.name,
      description: zone.description || '',
      is_active: zone.is_active,
      display_order: zone.display_order,
    });
    setShowZoneModal(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      setFormError('Zone name is required.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      if (editingZone) {
        await updateZone(editingZone.id, zoneForm);
      } else {
        await createZone(zoneForm);
      }
      setShowZoneModal(false);
      loadZones();
    } catch (error) {
      setFormError('Error saving zone. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const promptDeleteZone = (zone: ZoneWithDistricts) => {
    setDeleteError('');
    setDeleteConfirm({
      type: 'zone',
      id: zone.id,
      name: zone.name,
      extra: zone.districts ? `This will also delete all ${zone.districts.length} district(s).` : undefined,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError('');
    try {
      let success: boolean;
      if (deleteConfirm.type === 'zone') {
        success = await deleteZone(deleteConfirm.id);
      } else {
        success = await deleteDistrict(deleteConfirm.id);
      }
      if (!success) {
        setDeleteError('Cannot delete: it may have associated orders.');
        setDeleting(false);
        return;
      }
      setDeleteConfirm(null);
      loadZones();
    } catch (error) {
      setDeleteError('An error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleZoneActive = async (zone: Zone) => {
    await updateZone(zone.id, { is_active: !zone.is_active });
    loadZones();
  };

  // District CRUD handlers
  const openAddDistrictModal = (zoneId: string) => {
    setEditingDistrict(null);
    setSelectedZoneForDistrict(zoneId);
    setFormError('');
    setDistrictForm({ name: '', description: '', is_active: true, display_order: 0 });
    setShowDistrictModal(true);
  };

  const openEditDistrictModal = (district: District) => {
    setEditingDistrict(district);
    setSelectedZoneForDistrict(district.zone_id);
    setFormError('');
    setDistrictForm({
      name: district.name,
      description: district.description || '',
      is_active: district.is_active,
      display_order: district.display_order,
    });
    setShowDistrictModal(true);
  };

  const handleSaveDistrict = async () => {
    if (!districtForm.name.trim()) {
      setFormError('District name is required.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      if (editingDistrict) {
        await updateDistrict(editingDistrict.id, districtForm);
      } else {
        await createDistrict({ zone_id: selectedZoneForDistrict, ...districtForm });
      }
      setShowDistrictModal(false);
      loadZones();
    } catch (error) {
      setFormError('Error saving district. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const promptDeleteDistrict = (district: District) => {
    setDeleteError('');
    setDeleteConfirm({ type: 'district', id: district.id, name: district.name });
  };

  const handleToggleDistrictActive = async (district: District) => {
    await updateDistrict(district.id, { is_active: !district.is_active });
    loadZones();
  };

  // Special Zone handlers
  const openAddSpecialZoneModal = () => {
    setEditingSpecialZone(null);
    setFormError('');
    setSpecialZoneForm({ name: '', description: '', active_days: [], is_active: true });
    setShowSpecialZoneModal(true);
  };

  const openEditSpecialZoneModal = (sz: SpecialZone) => {
    setEditingSpecialZone(sz);
    setFormError('');
    setSpecialZoneForm({
      name: sz.name,
      description: sz.description || '',
      active_days: [...sz.active_days],
      is_active: sz.is_active,
    });
    setShowSpecialZoneModal(true);
  };

  const toggleSpecialZoneDay = (day: number) => {
    setSpecialZoneForm(prev => ({
      ...prev,
      active_days: prev.active_days.includes(day)
        ? prev.active_days.filter(d => d !== day)
        : [...prev.active_days, day].sort((a, b) => a - b),
    }));
  };

  const handleSaveSpecialZone = async () => {
    if (!specialZoneForm.name.trim()) {
      setFormError('Zone name is required.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      if (editingSpecialZone) {
        await updateSpecialZone(editingSpecialZone.id, specialZoneForm);
      } else {
        await createSpecialZone(specialZoneForm);
      }
      setShowSpecialZoneModal(false);
      loadSpecialZones();
    } catch {
      setFormError('Error saving special zone. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpecialZone = async (id: string) => {
    setDeletingSpecialZone(true);
    try {
      await deleteSpecialZone(id);
      setSpecialZoneDeleteConfirm(null);
      loadSpecialZones();
    } catch {
      // silently fail
    } finally {
      setDeletingSpecialZone(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-zinc-400">Loading zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Zones & Districts</h1>
            <p className="text-zinc-500 mt-1">Manage delivery zones and their districts</p>
          </div>
          <button onClick={openAddZoneModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Zone
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-6">
            <div className="text-zinc-400 text-sm font-medium">Total Zones</div>
            <div className="text-3xl font-bold text-emerald-400 mt-2">{zones.length}</div>
          </div>
          <div className="card p-6">
            <div className="text-zinc-400 text-sm font-medium">Total Districts</div>
            <div className="text-3xl font-bold text-blue-400 mt-2">
              {zones.reduce((sum, z) => sum + z.districts.length, 0)}
            </div>
          </div>
          <div className="card p-6">
            <div className="text-zinc-400 text-sm font-medium">Active Zones</div>
            <div className="text-3xl font-bold text-purple-400 mt-2">
              {zones.filter((z) => z.is_active).length}
            </div>
          </div>
        </div>

        {/* Zones List */}
        {zones.length === 0 ? (
          <div className="card p-12 text-center">
            <MapPin className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">No zones yet</h3>
            <p className="text-zinc-400 mb-6">Get started by creating your first delivery zone</p>
            <button
              onClick={openAddZoneModal}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Zone
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => (
              <div key={zone.id} className="card overflow-hidden">
                {/* Zone Header */}
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleZoneExpansion(zone.id)}
                      className="text-zinc-400 hover:text-emerald-400 transition-colors"
                    >
                      {expandedZones.has(zone.id) ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">{zone.name}</h3>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            zone.is_active
                              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                              : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
                          }`}
                        >
                          {zone.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-sm text-zinc-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {zone.districts.length} district{zone.districts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {zone.description && (
                        <p className="text-sm text-zinc-400 mt-1">{zone.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAddDistrictModal(zone.id)}
                      className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add District
                    </button>
                    <button
                      onClick={() => handleToggleZoneActive(zone)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        zone.is_active
                          ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20'
                          : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                      }`}
                    >
                      {zone.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openEditZoneModal(zone)}
                      className="text-zinc-400 hover:text-white p-2 transition-colors hover:bg-zinc-800 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => promptDeleteZone(zone)}
                      className="text-red-400 hover:text-red-300 p-2 transition-colors hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Districts List */}
                {expandedZones.has(zone.id) && (
                  <div className="border-t border-zinc-700 bg-zinc-900/50 p-5">
                    {zone.districts.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-400 mb-3">No districts in this zone yet</p>
                        <button
                          onClick={() => openAddDistrictModal(zone.id)}
                          className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add First District
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {zone.districts.map((district) => (
                          <div
                            key={district.id}
                            className="bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 rounded-xl p-4 flex items-center justify-between transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2.5">
                                <span className="font-medium text-white">{district.name}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                                    district.is_active
                                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                      : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
                                  }`}
                                >
                                  {district.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              {district.description && (
                                <p className="text-sm text-zinc-400 mt-1">{district.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleDistrictActive(district)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  district.is_active
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20'
                                    : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                                }`}
                              >
                                {district.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => openEditDistrictModal(district)}
                                className="text-zinc-400 hover:text-white p-2 transition-colors hover:bg-zinc-700 rounded-lg"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => promptDeleteDistrict(district)}
                                className="text-red-400 hover:text-red-300 p-2 transition-colors hover:bg-red-500/10 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Special Zones Section ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              Special Zones
            </h2>
            <p className="text-zinc-500 text-sm mt-0.5">Zones with fixed delivery day schedules</p>
          </div>
          <button onClick={openAddSpecialZoneModal} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Add Special Zone
          </button>
        </div>

        {specialZones.length === 0 ? (
          <div className="card p-8 text-center">
            <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No special zones yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Add a zone with fixed delivery days (e.g. BP + Muar on Mon/Wed/Fri).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {specialZones.map(sz => (
              <div key={sz.id} className="card px-5 py-4 border-l-[3px] border-l-amber-500/50">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-semibold text-white">{sz.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${
                          sz.is_active
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
                        }`}
                      >
                        {sz.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {sz.description && (
                      <p className="text-xs text-zinc-500 mt-0.5">{sz.description}</p>
                    )}
                    {/* Day pills */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {DAY_NUMBERS.map((day, i) => (
                        <span
                          key={day}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                            sz.active_days.includes(day)
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/50'
                          }`}
                        >
                          {DAY_LABELS[i]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {specialZoneDeleteConfirm === sz.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteSpecialZone(sz.id)}
                          disabled={deletingSpecialZone}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-lg hover:bg-rose-500/25 transition-colors"
                        >
                          {deletingSpecialZone ? '...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setSpecialZoneDeleteConfirm(null)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => openEditSpecialZoneModal(sz)}
                          className="text-zinc-400 hover:text-white p-2 transition-colors hover:bg-zinc-800 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSpecialZoneDeleteConfirm(sz.id)}
                          className="text-red-400 hover:text-red-300 p-2 transition-colors hover:bg-red-500/10 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special Zone Modal */}
      {showSpecialZoneModal && (
        <Modal
          isOpen={showSpecialZoneModal}
          onClose={() => setShowSpecialZoneModal(false)}
          title={editingSpecialZone ? 'Edit Special Zone' : 'Add Special Zone'}
        >
          <div className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Zone Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={specialZoneForm.name}
                onChange={(e) => setSpecialZoneForm({ ...specialZoneForm, name: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. BP + Muar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <input
                type="text"
                value={specialZoneForm.description}
                onChange={(e) => setSpecialZoneForm({ ...specialZoneForm, description: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. 2 drivers, backup available"
              />
            </div>

            {/* Day checkboxes */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">Active Delivery Days</label>
              <div className="grid grid-cols-7 gap-2">
                {DAY_NUMBERS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleSpecialZoneDay(day)}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      specialZoneForm.active_days.includes(day)
                        ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 shadow-sm shadow-amber-500/10'
                        : 'bg-zinc-800 text-zinc-500 border-2 border-zinc-700 hover:border-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {DAY_LABELS[i]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="special-zone-active"
                checked={specialZoneForm.is_active}
                onChange={(e) => setSpecialZoneForm({ ...specialZoneForm, is_active: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600"
              />
              <label htmlFor="special-zone-active" className="text-sm text-zinc-300">
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSaveSpecialZone}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingSpecialZone ? 'Update' : 'Create'}
              </button>
              <button onClick={() => setShowSpecialZoneModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Zone Modal */}
      {showZoneModal && (
        <Modal
          isOpen={showZoneModal}
          onClose={() => setShowZoneModal(false)}
          title={editingZone ? 'Edit Zone' : 'Add Zone'}
        >
          <div className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Zone Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., North Zone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <textarea
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="zone-active"
                checked={zoneForm.is_active}
                onChange={(e) => setZoneForm({ ...zoneForm, is_active: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600"
              />
              <label htmlFor="zone-active" className="text-sm text-zinc-300">
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSaveZone}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingZone ? 'Update Zone' : 'Create Zone'}
              </button>
              <button onClick={() => setShowZoneModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* District Modal */}
      {showDistrictModal && (
        <Modal
          isOpen={showDistrictModal}
          onClose={() => setShowDistrictModal(false)}
          title={editingDistrict ? 'Edit District' : 'Add District'}
        >
          <div className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                District Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={districtForm.name}
                onChange={(e) => setDistrictForm({ ...districtForm, name: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Kepong"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <textarea
                value={districtForm.description}
                onChange={(e) => setDistrictForm({ ...districtForm, description: e.target.value })}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="district-active"
                checked={districtForm.is_active}
                onChange={(e) => setDistrictForm({ ...districtForm, is_active: e.target.checked })}
                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600"
              />
              <label htmlFor="district-active" className="text-sm text-zinc-300">
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSaveDistrict}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingDistrict ? 'Update District' : 'Create District'}
              </button>
              <button onClick={() => setShowDistrictModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title={`Delete ${deleteConfirm.type === 'zone' ? 'Zone' : 'District'}`}
        >
          <div className="space-y-4">
            <p className="text-zinc-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">&ldquo;{deleteConfirm.name}&rdquo;</span>?
            </p>
            {deleteConfirm.type === 'zone' && deleteConfirm.extra && (
              <p className="text-sm text-zinc-400">{deleteConfirm.extra}</p>
            )}
            {deleteError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
