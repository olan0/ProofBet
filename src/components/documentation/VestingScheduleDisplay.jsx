import React, { useState, useEffect } from "react";
import { VestingSchedule } from "@/entities/VestingSchedule";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Lock, PlayCircle, CheckCircle } from "lucide-react";
import { differenceInMonths, addMonths } from 'date-fns';

export default function VestingScheduleDisplay() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const data = await VestingSchedule.list();
        setSchedules(data);
      } catch (error) {
        console.error("Failed to load vesting schedules", error);
      }
      setLoading(false);
    }
    loadSchedules();
  }, []);

  const getVestingStatus = (schedule) => {
    const now = new Date();
    const startDate = new Date(schedule.start_date);
    const cliffEndDate = addMonths(startDate, schedule.cliff_duration_months);
    const vestingEndDate = addMonths(startDate, schedule.vesting_duration_months);

    if (now < cliffEndDate) {
      return { label: "Locked", icon: <Lock className="w-4 h-4 text-red-400" />, color: "bg-red-500/10 text-red-300" };
    }
    if (now < vestingEndDate) {
      return { label: "Vesting", icon: <PlayCircle className="w-4 h-4 text-blue-400" />, color: "bg-blue-500/10 text-blue-300" };
    }
    return { label: "Fully Vested", icon: <CheckCircle className="w-4 h-4 text-green-400" />, color: "bg-green-500/10 text-green-300" };
  };
  
  const getUnlockedPercentage = (schedule) => {
    if (schedule.vesting_duration_months === 0) return 100;

    const now = new Date();
    const startDate = new Date(schedule.start_date);
    const cliffEndDate = addMonths(startDate, schedule.cliff_duration_months);
    
    if (now < cliffEndDate) {
      return 0;
    }

    const monthsSinceStart = differenceInMonths(now, startDate);
    const vestingDuration = schedule.vesting_duration_months;
    
    if (monthsSinceStart >= vestingDuration) {
      return 100;
    }

    const unlocked = (monthsSinceStart / vestingDuration) * 100;
    return Math.min(100, unlocked).toFixed(2);
  };

  if (loading) {
    return <div className="text-gray-400">Loading vesting schedules...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="bg-gray-800 border-gray-700 rounded-lg">
        <TableHeader>
          <TableRow className="border-b-gray-700">
            <TableHead className="text-white">Beneficiary</TableHead>
            <TableHead className="text-white">Total Allocation (PROOF)</TableHead>
            <TableHead className="text-white">Cliff</TableHead>
            <TableHead className="text-white">Vesting Period</TableHead>
            <TableHead className="text-white">Status</TableHead>
            <TableHead className="text-white text-right">Unlocked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => {
            const status = getVestingStatus(schedule);
            const unlocked = getUnlockedPercentage(schedule);
            return (
              <TableRow key={schedule.id} className="border-b-gray-700/50">
                <TableCell className="font-medium text-gray-200">{schedule.beneficiary}</TableCell>
                <TableCell className="text-gray-300">
                  {schedule.total_allocation.toLocaleString()} 
                  <span className="text-gray-400 ml-2">({schedule.allocation_percentage}%)</span>
                </TableCell>
                <TableCell className="text-gray-300">{schedule.cliff_duration_months} months</TableCell>
                <TableCell className="text-gray-300">{schedule.vesting_duration_months} months</TableCell>
                <TableCell>
                  <Badge className={`flex items-center gap-2 ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-gray-300">{unlocked}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}