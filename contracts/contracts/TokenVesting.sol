// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenVesting
 * @dev A token holder contract that releases token balance gradually
 *      following a linear vesting schedule with cliff and duration.
 */
contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint64 cliff;
        uint64 start;
        uint64 duration;
        uint256 totalAmount;
        uint256 released;
    }

    IERC20 public immutable token;
    mapping(address => VestingSchedule) private _vestingSchedules;
    address[] private _beneficiaries;

    event Released(address indexed beneficiary, uint256 amount);
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint64 start, uint64 cliff, uint64 duration);
    event VestingScheduleUpdated(address indexed beneficiary, uint256 newTotal);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    constructor(address token_) Ownable(msg.sender) {
        require(token_ != address(0), "Token address cannot be zero");
        token = IERC20(token_);
    }

    function createVestingSchedule(
        address beneficiary_,
        uint64 start_,
        uint64 cliff_,
        uint64 duration_,
        uint256 totalAmount_
    ) external onlyOwner {
        require(!_vestingSchedules[beneficiary_].initialized, "Schedule exists");
        require(totalAmount_ > 0, "Amount = 0");
        require(duration_ > 0, "Duration = 0");
        require(cliff_ <= duration_, "Cliff > duration");
        require(token.balanceOf(address(this)) >= totalAmount_, "Insufficient tokens");

        _vestingSchedules[beneficiary_] = VestingSchedule({
            initialized: true,
            beneficiary: beneficiary_,
            cliff: start_ + cliff_,
            start: start_,
            duration: duration_,
            totalAmount: totalAmount_,
            released: 0
        });

        _beneficiaries.push(beneficiary_);
        emit VestingScheduleCreated(beneficiary_, totalAmount_, start_, cliff_, duration_);
    }

    function release(address beneficiary_) external nonReentrant {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        require(schedule.initialized, "No schedule");

        uint256 vested = _vestedAmount(beneficiary_);
        uint256 releasable = vested - schedule.released;
        require(releasable > 0, "Nothing to release");

        schedule.released += releasable;
        token.safeTransfer(beneficiary_, releasable);
        emit Released(beneficiary_, releasable);
    }

    function _vestedAmount(address beneficiary_) private view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        if (!schedule.initialized || block.timestamp < schedule.cliff) return 0;
        uint64 end = schedule.start + schedule.duration;
        if (block.timestamp >= end) return schedule.totalAmount;
        return (schedule.totalAmount * (block.timestamp - schedule.start)) / schedule.duration;
    }

    // --- Views ---
    function getVestingSchedule(address beneficiary_) external view returns (VestingSchedule memory) {
        return _vestingSchedules[beneficiary_];
    }

    function getReleasableAmount(address beneficiary_) external view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary_];
        if (!schedule.initialized) return 0;
        return _vestedAmount(beneficiary_) - schedule.released;
    }

    function getVestingProgress(address beneficiary_) external view returns (uint256 percentVested) {
        VestingSchedule storage s = _vestingSchedules[beneficiary_];
        if (!s.initialized || block.timestamp < s.cliff) return 0;
        if (block.timestamp >= s.start + s.duration) return 100;
        return ((block.timestamp - s.start) * 100) / s.duration;
    }

    function getAllBeneficiaries() external view returns (address[] memory) {
        return _beneficiaries;
    }

    // --- Admin Utilities ---
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount = 0");
        token.safeTransfer(owner(), amount);
        emit EmergencyWithdrawal(owner(), amount);
    }
}
