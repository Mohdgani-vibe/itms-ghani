import { useState } from 'react';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Download, 
  Upload, 
  MonitorDown, 
  FileCheck, 
  Lock,
  Search, 
  Settings, 
  Bell, 
  ChevronDown,
  MoreVertical,
  Laptop,
  Monitor,
  Smartphone,
  X,
  Plus
} from 'lucide-react';

// Sample data
const users = [
  { id: 1, name: 'Ananya Mehta', email: 'ananya.mehta@zerodha.com', empId: 'EMP1001', role: 'Engineering Lead', dept: 'Engineering', status: 'active' as const, initials: 'AM', avatarColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 2, name: 'Rohit Sharma', email: 'rohit.sharma@zerodha.com', empId: 'EMP1002', role: 'DevOps Engineer', dept: 'Engineering', status: 'active' as const, initials: 'RS', avatarColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 3, name: 'Priya Nair', email: 'priya.nair@zerodha.com', empId: 'EMP1003', role: 'Compliance Analyst', dept: 'Compliance', status: 'active' as const, initials: 'PN', avatarColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 4, name: 'Karan Patel', email: 'karan.patel@zerodha.com', empId: 'EMP1004', role: 'SecOps Engineer', dept: 'Operations', status: 'active' as const, initials: 'KP', avatarColor: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 5, name: 'Sneha Reddy', email: 'sneha.reddy@zerodha.com', empId: 'EMP1005', role: 'Finance Manager', dept: 'Finance', status: 'inactive' as const, initials: 'SR', avatarColor: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 6, name: 'Arjun Iyer', email: 'arjun.iyer@zerodha.com', empId: 'EMP1006', role: 'Support Lead', dept: 'Support', status: 'active' as const, initials: 'AI', avatarColor: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
  { id: 7, name: 'Divya Krishnan', email: 'divya.krishnan@zerodha.com', empId: 'EMP1007', role: 'HR Specialist', dept: 'HR & Admin', status: 'active' as const, initials: 'DK', avatarColor: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { id: 8, name: 'Vikram Singh', email: 'vikram.singh@zerodha.com', empId: 'EMP1008', role: 'Backend Engineer', dept: 'Engineering', status: 'pending' as const, initials: 'VS', avatarColor: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
];

const departments = [
  { name: 'All Departments', count: 1284 },
  { name: 'Engineering', count: 412 },
  { name: 'Operations', count: 286 },
  { name: 'Compliance', count: 94 },
  { name: 'Finance', count: 147 },
  { name: 'Support', count: 203 },
  { name: 'HR & Admin', count: 142 },
];

const assets = [
  { name: 'MacBook Pro 14"', id: 'AST-MBP-2024-001', icon: Laptop },
  { name: 'Dell 27" Monitor', id: 'AST-MON-2024-089', icon: Monitor },
  { name: 'iPhone 14', id: 'AST-IPH-2024-156', icon: Smartphone },
];

export default function UsersPageModern() {
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user => {
    const matchesDept = selectedDept === 'All Departments' || user.dept === selectedDept;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.empId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesStatus && matchesSearch;
  });

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id: number) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedUsers(newSet);
  };

  const currentUser = selectedUser ? users.find(u => u.id === selectedUser) : null;

  return (
    <div style={{ 
      fontFamily: 'Inter, sans-serif', 
      backgroundColor: '#F1F4F9', 
      minHeight: 'calc(100vh - 56px)',
      width: '100%'
    }}>
      {/* Page Content */}
      <div style={{ 
        maxWidth: '1600px', 
        margin: '0 auto', 
        padding: '16px 20px',
        width: '100%'
      }}>
        {/* Page Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#0F1B2D', 
              margin: '0 0 4px 0',
              letterSpacing: '-0.01em'
            }}>
              User Management
            </h1>
            <p style={{ 
              fontSize: '13px', 
              color: '#8C96A4', 
              margin: 0 
            }}>
              Manage employees, roles, and access permissions
            </p>
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <select style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '0.5px solid #E0E0E0',
              background: '#fff',
              color: '#46505F',
              fontWeight: '500',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}>
              <option>Last 24h</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
            <button style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#2667E8',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <UserPlus size={16} />
              Add Employee
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '200px minmax(0, 1fr)', 
          gap: '24px',
          alignItems: 'start'
        }}>
          {/* Department Sidebar */}
          <div style={{
            background: '#fff',
            border: '0.5px solid #E0E0E0',
            borderRadius: '18px',
            padding: '14px 14px 14px 6px',
            position: 'sticky',
            top: '76px',
            boxShadow: '0 6px 20px -12px rgba(15,27,45,0.18)'
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '700', 
              color: '#8C96A4',
              letterSpacing: '0.05em',
              marginBottom: '4px'
            }}>
              DEPARTMENTS
            </div>
            <p style={{ 
              fontSize: '12px', 
              color: '#9AA4B2', 
              margin: '0 0 14px 0' 
            }}>
              Filter users by department
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {departments.map((dept) => (
                <button
                  key={dept.name}
                  onClick={() => setSelectedDept(dept.name)}
                  style={{
                    padding: '8px 12px 8px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedDept === dept.name ? '#2667E8' : 'transparent',
                    color: selectedDept === dept.name ? '#fff' : '#46505F',
                    fontSize: '14px',
                    fontWeight: selectedDept === dept.name ? '600' : '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                >
                  <span>{dept.name}</span>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '600',
                    opacity: selectedDept === dept.name ? 0.9 : 0.5
                  }}>
                    {dept.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div style={{
            background: '#fff',
            border: '0.5px solid #E0E0E0',
            borderRadius: '18px',
            padding: '10px',
            boxShadow: '0 6px 20px -12px rgba(15,27,45,0.18)'
          }}>
            {/* Filter Bar */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <Search 
                  size={16} 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#8C96A4'
                  }} 
                />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 36px',
                    borderRadius: '6px',
                    border: '0.5px solid #E0E0E0',
                    fontSize: '13px',
                    fontFamily: 'Inter, sans-serif',
                    color: '#0F1B2D'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Status Toggle */}
                <div style={{ 
                  display: 'inline-flex', 
                  background: '#F8F8F8', 
                  borderRadius: '6px', 
                  padding: '2px' 
                }}>
                  {(['all', 'active', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: statusFilter === status ? '#fff' : 'transparent',
                        color: statusFilter === status ? '#1B4FD1' : '#46505F',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s'
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Filter Chips */}
                {['Role', 'Entity', 'Branch', 'System'].map((filter) => (
                  <select
                    key={filter}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '0.5px solid #E0E0E0',
                      background: '#fff',
                      color: '#46505F',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    <option>{filter}: All</option>
                  </select>
                ))}
              </div>
            </div>

            {/* Selection Toolbar */}
            {selectedUsers.size > 0 && (
              <div style={{
                padding: '8px 12px',
                background: '#F4F8FF',
                borderRadius: '12px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filteredUsers.length}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', color: '#46505F' }}>
                    · showing {selectedUsers.size} of {filteredUsers.length}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #C13B40',
                    background: '#FEEFEF',
                    color: '#C13B40',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                    Deactivate
                  </button>
                  <button style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #1F8A50',
                    background: '#E7F6EE',
                    color: '#1F8A50',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                    Reactivate
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ 
                    borderBottom: '0.5px solid #E0E0E0',
                    display: 'grid',
                    gridTemplateColumns: '40px 300px 1fr 1fr 130px 40px'
                  }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleSelectAll}
                        style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#8C96A4', letterSpacing: '0.05em' }}>
                      EMPLOYEE
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: '#8C96A4', letterSpacing: '0.05em' }}>
                      ROLE
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: '#8C96A4', letterSpacing: '0.05em' }}>
                      DEPARTMENT
                    </th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: '700', color: '#8C96A4', letterSpacing: '0.05em' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '6px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUser(user.id)}
                      style={{
                        borderBottom: '0.5px solid #E0E0E0',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        display: 'grid',
                        gridTemplateColumns: '40px 300px 1fr 1fr 130px 40px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '8px 8px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: user.avatarColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {user.initials}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F1B2D', lineHeight: '1.3' }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8C96A4', lineHeight: '1.3' }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '13px', color: '#46505F', fontWeight: '500' }}>
                        {user.role}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: '13px', color: '#46505F', fontWeight: '500' }}>
                        {user.dept}
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: user.status === 'active' ? '#E7F6EE' : user.status === 'inactive' ? '#FEEFEF' : '#FFF7E8',
                          color: user.status === 'active' ? '#1F8A50' : user.status === 'inactive' ? '#C13B40' : '#B7791F',
                          textTransform: 'capitalize'
                        }}>
                          {user.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 8px' }} onClick={(e) => e.stopPropagation()}>
                        <button style={{ 
                          padding: '4px', 
                          border: 'none', 
                          background: 'transparent', 
                          cursor: 'pointer',
                          color: '#8C96A4'
                        }}>
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{
              marginTop: '24px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingTop: '18px',
              borderTop: '0.5px solid #E0E0E0'
            }}>
              <div style={{ fontSize: '12px', color: '#8C96A4' }}>
                Showing 1–{filteredUsers.length} of {departments.find(d => d.name === selectedDept)?.count || 0} users
              </div>
              <div style={{ display: 'flex', gap: '9px' }}>
                <button style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '0.5px solid #E0E0E0',
                  background: '#fff',
                  color: '#46505F',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Prev
                </button>
                <button style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#2667E8',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                  1
                </button>
                <button style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '0.5px solid #E0E0E0',
                  background: '#fff',
                  color: '#46505F',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  2
                </button>
                <button style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '0.5px solid #E0E0E0',
                  background: '#fff',
                  color: '#46505F',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  3
                </button>
                <span style={{ padding: '4px 8px', color: '#8C96A4', fontSize: '12px' }}>...</span>
                <button style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '0.5px solid #E0E0E0',
                  background: '#fff',
                  color: '#46505F',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Drawer */}
      {selectedUser && currentUser && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedUser(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 27, 45, 0.4)',
              zIndex: 50,
              animation: 'fadeIn 0.28s ease-out'
            }}
          />
          
          {/* Drawer */}
          <div
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: '360px',
              background: '#fff',
              boxShadow: '-4px 0 24px rgba(15, 27, 45, 0.15)',
              zIndex: 51,
              transform: 'translateX(0)',
              transition: 'transform 0.28s ease-out',
              overflowY: 'auto',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            {/* Drawer Header */}
            <div style={{ 
              padding: '24px', 
              borderBottom: '1px solid #EAEDF2',
              position: 'sticky',
              top: 0,
              background: '#fff',
              zIndex: 10
            }}>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  padding: '6px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#8C96A4'
                }}
              >
                <X size={20} />
              </button>
              
              {/* User Info */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: currentUser.avatarColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '24px',
                  margin: '0 auto 16px'
                }}>
                  {currentUser.initials}
                </div>
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: '700', 
                  color: '#0F1B2D', 
                  margin: '0 0 4px 0' 
                }}>
                  {currentUser.name}
                </h2>
                <div style={{ fontSize: '13px', color: '#8C96A4', marginBottom: '4px' }}>
                  {currentUser.empId}
                </div>
                <div style={{ fontSize: '13px', color: '#8C96A4' }}>
                  {currentUser.dept}
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#F4F8FF',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#8C96A4', marginBottom: '4px' }}>
                    ROLE
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F1B2D' }}>
                    {currentUser.role}
                  </div>
                </div>
                <div style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: currentUser.status === 'active' ? '#E7F6EE' : '#FEEFEF',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#8C96A4', marginBottom: '4px' }}>
                    STATUS
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    color: currentUser.status === 'active' ? '#1F8A50' : '#C13B40',
                    textTransform: 'capitalize'
                  }}>
                    {currentUser.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: '24px' }}>
              {/* Assigned Assets */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#8C96A4',
                  letterSpacing: '0.05em',
                  marginBottom: '16px'
                }}>
                  ASSIGNED ASSETS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {assets.map((asset) => {
                    const Icon = asset.icon;
                    return (
                      <div
                        key={asset.id}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1px solid #EAEDF2',
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '18px'
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: '#F4F8FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={20} color="#2667E8" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            color: '#0F1B2D',
                            marginBottom: '2px'
                          }}>
                            {asset.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8C96A4' }}>
                            {asset.id}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <button style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(180deg, #2E73F0, #1B4FD1)',
                color: '#fff',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(38, 103, 232, 0.3)'
              }}>
                View full profile
                <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        * {
          box-sizing: border-box;
        }
        
        button:hover {
          opacity: 0.9;
        }
        
        input[type="checkbox"] {
          accent-color: #2667E8;
        }
        
        input::placeholder {
          color: #9AA4B2;
        }
        
        select:focus,
        input:focus {
          outline: none;
          border-color: #2667E8;
        }
      `}</style>
    </div>
  );
}
