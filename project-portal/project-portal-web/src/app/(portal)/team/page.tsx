// File: app/team/page.tsx
'use client';

import { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Award,
  Shield,
  CheckCircle,
  Clock,
  MessageSquare,
  Video,
  FileText,
  TrendingUp,
  MoreVertical,
  Filter,
  Search,
  Download,
  Share2,
  Eye,
  Edit,
  X,
  Plus
} from 'lucide-react';

const TeamPage = () => {
  const [activeTab, setActiveTab] = useState('members');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock team data
  const teamMembers = [
    {
      id: 1,
      name: 'Samuel Kariuki',
      role: 'Lead Farmer',
      project: 'Kenyan Agroforestry Initiative',
      location: 'Nairobi, Kenya',
      phone: '+254 712 345 678',
      email: 'samuel@carbonscribe.farm',
      joined: 'Mar 2023',
      status: 'active',
      skills: ['Agroforestry', 'Soil Management', 'Training'],
      tasksCompleted: 42,
      creditsGenerated: 320,
      avatarColor: 'bg-emerald-500'
    },
    {
      id: 2,
      name: 'Maria Santos',
      role: 'Field Coordinator',
      project: 'Amazon Rainforest Restoration',
      location: 'Manaus, Brazil',
      phone: '+55 92 98765 4321',
      email: 'maria@carbonscribe.farm',
      joined: 'Jan 2023',
      status: 'active',
      skills: ['Reforestation', 'Community Engagement', 'GIS'],
      tasksCompleted: 56,
      creditsGenerated: 450,
      avatarColor: 'bg-blue-500'
    },
    {
      id: 3,
      name: 'Raj Patel',
      role: 'Soil Scientist',
      project: 'Midwest Soil Carbon Project',
      location: 'Iowa, USA',
      phone: '+1 515 123 4567',
      email: 'raj@carbonscribe.farm',
      joined: 'Feb 2024',
      status: 'active',
      skills: ['Soil Analysis', 'Carbon Measurement', 'Research'],
      tasksCompleted: 18,
      creditsGenerated: 210,
      avatarColor: 'bg-amber-500'
    },
    {
      id: 4,
      name: 'Fatima Al-Mansoori',
      role: 'Mangrove Specialist',
      project: 'Sundarbans Mangrove Conservation',
      location: 'Khulna, Bangladesh',
      phone: '+880 1712 345678',
      email: 'fatima@carbonscribe.farm',
      joined: 'Nov 2022',
      status: 'active',
      skills: ['Blue Carbon', 'Marine Ecology', 'Conservation'],
      tasksCompleted: 67,
      creditsGenerated: 580,
      avatarColor: 'bg-teal-500'
    },
    {
      id: 5,
      name: 'James Omondi',
      role: 'Training Officer',
      project: 'Kenyan Agroforestry Initiative',
      location: 'Nakuru, Kenya',
      phone: '+254 723 456 789',
      email: 'james@carbonscribe.farm',
      joined: 'Apr 2023',
      status: 'pending',
      skills: ['Training', 'Monitoring', 'Reporting'],
      tasksCompleted: 12,
      creditsGenerated: 85,
      avatarColor: 'bg-purple-500'
    },
    {
      id: 6,
      name: 'Chen Wei',
      role: 'Bamboo Expert',
      project: 'Vietnam Bamboo Plantation',
      location: 'Mekong Delta, Vietnam',
      phone: '+84 90 123 4567',
      email: 'chen@carbonscribe.farm',
      joined: 'Sep 2023',
      status: 'active',
      skills: ['Bamboo Cultivation', 'Sustainable Harvesting', 'Processing'],
      tasksCompleted: 34,
      creditsGenerated: 180,
      avatarColor: 'bg-green-500'
    },
    {
      id: 7,
      name: 'Amina Diallo',
      role: 'Community Liaison',
      project: 'Ethiopian Forest Protection',
      location: 'Addis Ababa, Ethiopia',
      phone: '+251 91 123 4567',
      email: 'amina@carbonscribe.farm',
      joined: 'Jul 2022',
      status: 'inactive',
      skills: ['Community Outreach', 'Conflict Resolution', 'Local Knowledge'],
      tasksCompleted: 89,
      creditsGenerated: 890,
      avatarColor: 'bg-rose-500'
    },
    {
      id: 8,
      name: 'Carlos Mendez',
      role: 'Drone Operator',
      project: 'All Projects',
      location: 'Remote',
      phone: '+1 305 987 6543',
      email: 'carlos@carbonscribe.farm',
      joined: 'May 2023',
      status: 'active',
      skills: ['Aerial Mapping', 'Photogrammetry', 'Data Analysis'],
      tasksCompleted: 45,
      creditsGenerated: 1250,
      avatarColor: 'bg-indigo-500'
    },
  ];

  const communityStats = [
    { label: 'Total Community Members', value: '156', change: '+12%', icon: Users },
    { label: 'Training Sessions Completed', value: '42', change: '+8%', icon: Award },
    { label: 'Local Jobs Created', value: '89', change: '+24%', icon: TrendingUp },
    { label: 'Women Participation', value: '64%', change: '+15%', icon: Shield },
  ];

  const upcomingEvents = [
    { id: 1, title: 'Soil Health Workshop', date: 'Apr 15, 2024', time: '10:00 AM', location: 'Nairobi Center', attendees: 24 },
    { id: 2, title: 'Carbon Credit Training', date: 'Apr 20, 2024', time: '2:00 PM', location: 'Virtual', attendees: 56 },
    { id: 3, title: 'Tree Planting Day', date: 'Apr 25, 2024', time: '8:00 AM', location: 'Amazon Site', attendees: 45 },
    { id: 4, title: 'Quarterly Review Meeting', date: 'May 5, 2024', time: '11:00 AM', location: 'Virtual', attendees: 18 },
  ];

  const getStatusConfig = (status: string) => {
    const configs = {
      active: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
      pending: { color: 'bg-amber-100 text-amber-700', icon: Clock },
      inactive: { color: 'bg-gray-100 text-gray-700', icon: X },
    };
    return configs[status as keyof typeof configs] || configs.active;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">Team & Community</h1>
            <p className="text-emerald-100 opacity-90">Manage your project team and community engagement</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <button className="flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors">
              <UserPlus className="w-5 h-5 mr-2" />
              Invite Member
            </button>
            <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </button>
          </div>
        </div>
      </div>

      {/* Community Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {communityStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm font-medium text-emerald-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                {stat.change} from last quarter
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Team Members */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
                <p className="text-gray-600">Manage your project team and collaborators</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search team members..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  >
                    <option value="all">All Projects</option>
                    <option value="amazon">Amazon Restoration</option>
                    <option value="kenya">Kenyan Agroforestry</option>
                    <option value="sundarbans">Mangrove Conservation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              {['members', 'roles', 'permissions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium capitalize ${
                    activeTab === tab 
                      ? 'text-emerald-600 border-b-2 border-emerald-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Team Members Grid */}
            {activeTab === 'members' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teamMembers.map((member) => {
                  const statusConfig = getStatusConfig(member.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div key={member.id} className="border border-gray-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-lg transition-all">
                      {/* Member Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className={`${member.avatarColor} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4`}>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{member.name}</h3>
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="w-4 h-4 mr-1" />
                              {member.location}
                            </div>
                          </div>
                        </div>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4 mr-2" />
                          {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </div>
                      </div>

                      {/* Member Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Role</div>
                          <div className="font-medium text-gray-900">{member.role}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Project</div>
                          <div className="font-medium text-gray-900">{member.project}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Joined</div>
                          <div className="font-medium text-gray-900">{member.joined}</div>
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-2">Skills</div>
                        <div className="flex flex-wrap gap-2">
                          {member.skills.map((skill, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Performance */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold text-gray-900">{member.tasksCompleted}</div>
                          <div className="text-xs text-gray-600">Tasks Completed</div>
                        </div>
                        <div className="text-center p-3 bg-emerald-50 rounded-lg">
                          <div className="text-lg font-bold text-emerald-700">{member.creditsGenerated}</div>
                          <div className="text-xs text-emerald-600">Credits Generated</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Email">
                            <Mail className="w-5 h-5 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Call">
                            <Phone className="w-5 h-5 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Message">
                            <MessageSquare className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Eye className="w-5 h-5 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Edit className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Community & Events */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Upcoming Events</h3>
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
            
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="p-4 border border-gray-200 rounded-xl hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-bold text-gray-900">{event.title}</h4>
                    <div className="text-sm font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                      {event.date}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      {event.time} • {event.location}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        {event.attendees} attending
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-1 hover:bg-gray-100 rounded-lg">
                          <Video className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded-lg">
                          <MessageSquare className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded-lg">
                          <Share2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-6 py-3 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
              View All Events
            </button>
          </div>

          {/* Community Resources */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Community Resources</h3>
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            
            <div className="space-y-4">
              {[
                { title: 'Training Manuals', count: 12, icon: '📚', color: 'bg-blue-100 text-blue-700' },
                { title: 'Safety Protocols', count: 8, icon: '🛡️', color: 'bg-emerald-100 text-emerald-700' },
                { title: 'Best Practices', count: 24, icon: '⭐', color: 'bg-amber-100 text-amber-700' },
                { title: 'Regulatory Guides', count: 6, icon: '📋', color: 'bg-purple-100 text-purple-700' },
              ].map((resource, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${resource.color} mr-3`}>
                      <span className="text-xl">{resource.icon}</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{resource.title}</div>
                      <div className="text-sm text-gray-600">{resource.count} documents</div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
            <h3 className="font-bold text-xl mb-4">Team Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <MessageSquare className="w-5 h-5 mr-3" />
                  <span>Send Group Message</span>
                </div>
                <Plus className="w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <Video className="w-5 h-5 mr-3" />
                  <span>Schedule Team Meeting</span>
                </div>
                <Calendar className="w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <Award className="w-5 h-5 mr-3" />
                  <span>Recognize Achievement</span>
                </div>
                <Award className="w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-3" />
                  <span>Share Progress Report</span>
                </div>
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Training Progress */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Training Progress</h3>
            <p className="text-gray-600">Track team training and certification status</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
            Assign Training
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Team Member</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Role</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Required Training</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Progress</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Certification</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Samuel Kariuki', role: 'Lead Farmer', training: 'Carbon Farming Basics', progress: 100, certified: true },
                { name: 'Maria Santos', role: 'Field Coordinator', training: 'Project Management', progress: 85, certified: false },
                { name: 'Raj Patel', role: 'Soil Scientist', training: 'Advanced Soil Analysis', progress: 60, certified: false },
                { name: 'Fatima Al-Mansoori', role: 'Mangrove Specialist', training: 'Blue Carbon Methodologies', progress: 100, certified: true },
                { name: 'James Omondi', role: 'Training Officer', training: 'Training of Trainers', progress: 30, certified: false },
              ].map((member, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-600">{member.role}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{member.role}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{member.training}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden mr-3">
                        <div 
                          className={`h-full ${member.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full`}
                          style={{ width: `${member.progress}%` }}
                        ></div>
                      </div>
                      <div className="font-medium text-gray-900">{member.progress}%</div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      member.certified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {member.certified ? 'Certified' : 'In Progress'}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <button className="px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                      {member.certified ? 'View Certificate' : 'Continue Training'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeamPage;