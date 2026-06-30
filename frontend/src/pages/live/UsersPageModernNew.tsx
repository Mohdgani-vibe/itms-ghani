import { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  ChevronDown,
  Edit2,
  MoreVertical,
  Check
} from 'lucide-react';

// Sample data with exact names and roles from spec
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

const formatCount = (num: number) => num.toLocaleString('en-US');

type StatusType = 'all' | 'active' | 'inactive' | 'pending';

export default function UsersPageModernNew() {
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState<StatusType>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user => {
    const matchesDept = selectedDept === 'All Departments' || user.dept === selectedDept;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase());
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

  const getStatusStyle = (status: 'active' | 'inactive' | 'pending') => {
    switch (status) {
      case 'active':
        return {
          bg: '#e7f6ec',
          text: '#1a7f47',
          dot: '#1a7f47'
        };
      case 'inactive':
        return {
          bg: '#f0f1f3',
          text: '#6b7280',
          dot: '#9aa1ab'
        };
      case 'pending':
        return {
          bg: '#fdf0dc',
          text: '#b45309',
          dot: '#d97706'
        };
    }
  };

  return (
    <div style={{ 
      fontFamily: 'Public Sans, sans-serif',
      backgroundColor: '#f5f6f8',
      minHeight: 'calc(100vh - 60px)',
      width: '100%'
    }}>
      {/* Body Container */}
      <div style={{ 
        width: '100%',
        margin: 0,
        padding: '28px 32px 48px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{
              fontSize: '26px',
              fontWeight: '600',
              color: '#1a1d21',
              margin: '0 0 4px 0',
              letterSpacing: '-0.5px'
            }}>
              User Management
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0
            }}>
              Manage employees, roles, and access permissions
            </p>
          </div>
          <button style={{
            padding: '11px 18px',
            borderRadius: '9px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 2px rgba(37,99,235,.35), 0 4px 12px rgba(37,99,235,.25)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
          >
            <UserPlus size={16} />
            Add Employee
          </button>
        </div>

        {/* Two Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '248px 1fr',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* Department Rail */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e6e8eb',
            borderRadius: '14px',
            padding: '8px',
            position: 'sticky',
            top: '80px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#9aa1ab',
              letterSpacing: '0.6px',
              padding: '12px 12px 10px 11px'
            }}>
              DEPARTMENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {departments.map(dept => (
                <button
                  key={dept.name}
                  onClick={() => setSelectedDept(dept.name)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '11px 12px',
                    borderRadius: '9px',
                    border: 'none',
                    background: selectedDept === dept.name ? '#eef2ff' : 'transparent',
                    color: selectedDept === dept.name ? '#2563eb' : '#3a3f47',
                    fontSize: '14px',
                    fontWeight: selectedDept === dept.name ? '600' : '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDept !== dept.name) {
                      e.currentTarget.style.background = '#f5f6f8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDept !== dept.name) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span>{dept.name}</span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '7px',
                    background: selectedDept === dept.name ? '#dbe4ff' : '#f0f1f3',
                    color: selectedDept === dept.name ? '#2563eb' : '#9aa1ab'
                  }}>
                    {formatCount(dept.count)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Panel */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e6e8eb',
            borderRadius: '14px',
            overflow: 'hidden'
          }}>
            {/* Toolbar */}
            <div style={{
              padding: '16px 18px',
              borderBottom: '1px solid #eef0f2',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              {/* Search */}
              <div style={{
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 14px',
                background: '#f5f6f8',
                border: '1px solid #eef0f2',
                borderRadius: '9px'
              }}>
                <Search size={16} style={{ color: '#9aa1ab', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search employees by name, email, or role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '14px',
                    color: '#1a1d21',
                    fontFamily: 'Public Sans, sans-serif'
                  }}
                />
              </div>

              {/* Filter Row */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {/* Status Segmented Control */}
                <div style={{
                  display: 'inline-flex',
                  background: '#f0f1f3',
                  borderRadius: '9px',
                  padding: '3px',
                  gap: 0
                }}>
                  {(['all', 'active', 'inactive', 'pending'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '7px',
                        border: 'none',
                        background: statusFilter === status ? '#ffffff' : 'transparent',
                        color: statusFilter === status ? '#1a1d21' : '#6b7280',
                        fontSize: '13px',
                        fontWeight: statusFilter === status ? '600' : '500',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        boxShadow: statusFilter === status ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div style={{
                  width: '1px',
                  height: '22px',
                  background: '#e6e8eb'
                }} />

                {/* Dropdowns */}
                <select style={{
                  height: '36px',
                  padding: '0 30px 0 12px',
                  border: '1px solid #e6e8eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#5b626d',
                  fontFamily: 'Public Sans, sans-serif',
                  cursor: 'pointer',
                  background: '#ffffff',
                  outline: 'none'
                }}>
                  <option>Role: All</option>
                </select>

                <select style={{
                  height: '36px',
                  padding: '0 30px 0 12px',
                  border: '1px solid #e6e8eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#5b626d',
                  fontFamily: 'Public Sans, sans-serif',
                  cursor: 'pointer',
                  background: '#ffffff',
                  outline: 'none'
                }}>
                  <option>Entity: All</option>
                </select>

                <select style={{
                  height: '36px',
                  padding: '0 30px 0 12px',
                  border: '1px solid #e6e8eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#5b626d',
                  fontFamily: 'Public Sans, sans-serif',
                  cursor: 'pointer',
                  background: '#ffffff',
                  outline: 'none'
                }}>
                  <option>Branch: All</option>
                </select>

                {/* Result Count */}
                <div style={{
                  marginLeft: 'auto',
                  fontSize: '13px',
                  color: '#9aa1ab'
                }}>
                  {formatCount(filteredUsers.length)} results
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ 
                    display: 'grid',
                    gridTemplateColumns: '44px 2.4fr 1.6fr 1.2fr 110px 44px',
                    padding: '12px 18px',
                    borderBottom: '1px solid #eef0f2',
                    background: '#fafbfc'
                  }}>
                    <th style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleSelectAll}
                        style={{
                          width: '17px',
                          height: '17px',
                          borderRadius: '5px',
                          border: '1.5px solid #cdd2d9',
                          cursor: 'pointer',
                          accentColor: '#2563eb'
                        }}
                      />
                    </th>
                    <th style={{ 
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#9aa1ab',
                      letterSpacing: '0.5px'
                    }}>
                      EMPLOYEE
                    </th>
                    <th style={{ 
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#9aa1ab',
                      letterSpacing: '0.5px'
                    }}>
                      ROLE
                    </th>
                    <th style={{ 
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#9aa1ab',
                      letterSpacing: '0.5px'
                    }}>
                      DEPARTMENT
                    </th>
                    <th style={{ 
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#9aa1ab',
                      letterSpacing: '0.5px'
                    }}>
                      STATUS
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const statusStyle = getStatusStyle(user.status);
                    return (
                      <tr
                        key={user.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 2.4fr 1.6fr 1.2fr 110px 44px',
                          padding: '13px 18px',
                          borderBottom: '1px solid #f2f3f5',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => toggleSelectUser(user.id)}
                            style={{
                              width: '17px',
                              height: '17px',
                              borderRadius: '5px',
                              border: '1.5px solid #cdd2d9',
                              cursor: 'pointer',
                              accentColor: '#2563eb'
                            }}
                          />
                        </td>
                        <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: user.avatarColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: '600',
                            flexShrink: 0
                          }}>
                            {user.initials}
                          </div>
                          <div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1a1d21',
                              lineHeight: '1.3'
                            }}>
                              {user.name}
                            </div>
                            <div style={{
                              fontSize: '12.5px',
                              color: '#8b919b',
                              lineHeight: '1.3'
                            }}>
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          fontSize: '14px',
                          color: '#3a3f47'
                        }}>
                          {user.role}
                        </td>
                        <td style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          fontSize: '14px',
                          color: '#3a3f47'
                        }}>
                          {user.dept}
                        </td>
                        <td style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: statusStyle.bg,
                            fontSize: '12px',
                            fontWeight: '600',
                            color: statusStyle.text,
                            textTransform: 'capitalize'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: statusStyle.dot
                            }} />
                            {user.status}
                          </span>
                        </td>
                        <td style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'flex-end',
                          gap: '2px'
                        }}>
                          <button 
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              border: 'none',
                              background: 'transparent',
                              color: '#5b626d',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#eef2ff';
                              e.currentTarget.style.color = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#5b626d';
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              border: 'none',
                              background: 'transparent',
                              color: '#5b626d',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f0f1f3';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 18px'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#8b919b'
              }}>
                Showing 1–{filteredUsers.length} of {formatCount(departments.find(d => d.name === selectedDept)?.count || 0)} users
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={{
                  height: '34px',
                  padding: '0 13px',
                  borderRadius: '8px',
                  border: '1px solid #e6e8eb',
                  background: '#ffffff',
                  color: '#5b626d',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: 'Public Sans, sans-serif'
                }}>
                  Prev
                </button>
                <button style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'Public Sans, sans-serif'
                }}>
                  1
                </button>
                <button style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #e6e8eb',
                  background: '#ffffff',
                  color: '#5b626d',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: 'Public Sans, sans-serif'
                }}>
                  2
                </button>
                <button style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #e6e8eb',
                  background: '#ffffff',
                  color: '#5b626d',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: 'Public Sans, sans-serif'
                }}>
                  3
                </button>
                <span style={{
                  padding: '0 4px',
                  color: '#9aa1ab',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  ...
                </span>
                <button style={{
                  height: '34px',
                  padding: '0 13px',
                  borderRadius: '8px',
                  border: '1px solid #e6e8eb',
                  background: '#ffffff',
                  color: '#5b626d',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: 'Public Sans, sans-serif'
                }}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
