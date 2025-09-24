// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// This is a simple ERC20 token for testing purposes on local networks.
contract MockERC20 is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    // Function to mint tokens to any address, useful for testing.
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}