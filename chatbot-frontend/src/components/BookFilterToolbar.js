import React, { useState } from 'react';

const BookFilterToolbar = ({
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  availableFilters,
  clearAllFilters,
  viewMode
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    console.log(`🔍 Filter changed: ${filterType} = ${value}`);
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Handle sort changes
  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Enhanced Search Bar */}
        <div className="flex-1 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search books by title, subject, or author..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full p-4 pl-12 pr-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-white border-2 border-gray-300 rounded-xl px-6 py-4 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
        >
          <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="font-medium">Filters</span>
        </button>

        {/* Sort Button */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="bg-white border-2 border-gray-300 rounded-xl px-6 py-4 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v14m8-14v14" />
            </svg>
            <span className="font-medium">Sort</span>
          </button>

          {showSortDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <div className="py-2">
                {viewMode === "subscribed" 
                  ? ['title', 'subject', 'grade', 'progress', 'lastAccessed', 'createdAt'].map((field) => (
                    <button
                      key={field}
                      onClick={() => {
                        handleSortChange(field);
                        setShowSortDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 capitalize flex items-center justify-between"
                    >
                      <span>
                        {field === 'createdAt' ? 'Date Added' : 
                         field === 'lastAccessed' ? 'Last Accessed' : field}
                      </span>
                      {sortBy === field && (
                        <span className="text-blue-500">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  ))
                  : ['title', 'subject', 'grade', 'createdAt'].map((field) => (
                    <button
                      key={field}
                      onClick={() => {
                        handleSortChange(field);
                        setShowSortDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 capitalize flex items-center justify-between"
                    >
                      <span>{field === 'createdAt' ? 'Date Added' : field}</span>
                      {sortBy === field && (
                        <span className="text-blue-500">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={filters.subject}
              onChange={(e) => handleFilterChange('subject', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {((availableFilters || {}).subjects || []).map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
            <select
              value={filters.grade}
              onChange={(e) => handleFilterChange('grade', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Grades</option>
              {((availableFilters || {}).grades || []).map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Publisher</label>
            <select
              value={filters.publisher}
              onChange={(e) => handleFilterChange('publisher', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Publishers</option>
              {((availableFilters || {}).publishers || []).map(publisher => (
                <option key={publisher} value={publisher}>{publisher}</option>
              ))}
            </select>
          </div>

          {/* Status filter for subscribed view */}
          {viewMode === "subscribed" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          <div className="md:col-span-3 flex gap-2">
            <button
              onClick={clearAllFilters}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookFilterToolbar; 