import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FIELD_OPTIONS = [
  { value: 'title', label: 'Title', type: 'text' },
  { value: 'creator', label: 'Creator', type: 'text' },
  { value: 'status', label: 'Status', type: 'select', options: [
    { value: '0', label: 'Open for Bets' },
    { value: '1', label: 'Awaiting Proof' },
    { value: '2', label: 'Voting' },
    { value: '3', label: 'Completed' },
    { value: '4', label: 'Cancelled' },
  ]},
  { value: 'category', label: 'Category', type: 'number' },
  { value: 'proofType', label: 'Proof Type', type: 'number' },
  { value: 'yesVotes', label: 'Yes Votes', type: 'number' },
  { value: 'noVotes', label: 'No Votes', type: 'number' },
  { value: 'invalidVotes', label: 'Invalid Votes', type: 'number' },
  { value: 'totalVotes', label: 'Total Votes', type: 'number' },
  { value: 'totalParticipants', label: 'Participants', type: 'number' },
  { value: 'totalBet', label: 'Total Bets', type: 'number' },
  { value: 'bettingDeadline', label: 'Betting Deadline', type: 'number' },
  { value: 'proofDeadline', label: 'Proof Deadline', type: 'number' },
  { value: 'votingDeadline', label: 'Voting Deadline', type: 'number' },
  { value: 'createdAt', label: 'Created Date', type: 'date' },
];

const OPERATORS = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'gte', label: '>=' },
    { value: 'lte', label: '<=' },
  ],
  date: [
    { value: 'equals', label: '=' },
    { value: 'gte', label: '>=' },
    { value: 'lte', label: '<=' },
  ],
  select: [
    { value: 'equals', label: '=' },
  ]
};

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'totalParticipants', label: 'Participants' },
  { value: 'totalBet', label: 'Total Bets' },
  { value: 'totalVotes', label: 'Total Votes' },
  { value: 'yesVotes', label: 'Yes Votes' },
  { value: 'noVotes', label: 'No Votes' },
  { value: 'bettingDeadline', label: 'Betting Deadline' },
  { value: 'proofDeadline', label: 'Proof Deadline' },
  { value: 'votingDeadline', label: 'Voting Deadline' },
];

export default function SearchBar({ onSearch, onReset }) {
  const [conditions, setConditions] = useState([]);
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isExpanded, setIsExpanded] = useState(true);

  const addCondition = () => {
    setConditions([...conditions, { id: Date.now(), field: '', operator: '', value: '' }]);
  };

  const removeCondition = (id) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id, key, value) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [key]: value } : c));
  };

  const handleSearch = () => {
    const filters = { 
      sort: sortField,
      order: sortOrder
    };
    
    conditions.forEach(condition => {
      if (condition.field && condition.operator && condition.value) {
        const operator = condition.operator;
        const field = condition.field;
        
        if (operator === 'contains') {
          filters[`contains_${field}`] = condition.value;
        } else if (operator === 'equals') {
          filters[field] = condition.value;
        } else if (operator === 'gt' || operator === 'gte') {
          filters[`min_${field}`] = condition.value;
        } else if (operator === 'lt' || operator === 'lte') {
          filters[`max_${field}`] = condition.value;
        }
      }
    });
    
    onSearch(filters);
  };

  const handleReset = () => {
    setConditions([]);
    setSortField("createdAt");
    setSortOrder("desc");
    onReset();
  };

  const getFieldConfig = (fieldValue) => {
    return FIELD_OPTIONS.find(f => f.value === fieldValue);
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <Search className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Search & Filters</span>
            {conditions.length > 0 && (
              <span className="text-xs text-cyan-400">({conditions.length} active)</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {isExpanded && (
          <div className="space-y-4 pt-2">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-gray-400">Sort by:</span>
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600 text-white">
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[140px] bg-gray-700 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600 text-white">
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {conditions.length > 0 && (
          <div className="space-y-2">
            {conditions.map((condition) => {
              const fieldConfig = getFieldConfig(condition.field);
              const operators = fieldConfig ? OPERATORS[fieldConfig.type] : [];
              return (
                <div key={condition.id} className="flex gap-2 items-center">
                  <Select 
                    value={condition.field} 
                    onValueChange={(value) => updateCondition(condition.id, 'field', value)}
                  >
                    <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600 text-white">
                      {FIELD_OPTIONS.map(field => (
                        <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {condition.field && (
                    <Select 
                      value={condition.operator} 
                      onValueChange={(value) => updateCondition(condition.id, 'operator', value)}
                    >
                      <SelectTrigger className="w-[100px] bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Op" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600 text-white">
                        {operators.map(op => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {fieldConfig?.type === 'select' ? (
                    <Select 
                      value={condition.value} 
                      onValueChange={(value) => updateCondition(condition.id, 'value', value)}
                    >
                      <SelectTrigger className="flex-1 bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-700 border-gray-600 text-white">
                        {fieldConfig.options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={fieldConfig?.type || 'text'}
                      placeholder="Enter value"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeCondition(condition.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={addCondition}
            className="border-gray-600 bg-gray-700 hover:bg-gray-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Filter
          </Button>

          <Button onClick={handleSearch} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>

          {conditions.length > 0 && (
            <Button onClick={handleReset} variant="ghost" className="text-gray-400 hover:text-white">
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}