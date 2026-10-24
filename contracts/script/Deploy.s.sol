// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {EntryPoint} from "@account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {MockMerchant} from "../src/MockMerchant.sol";

// ============================================================================
// OWNERSHIP: This file is owned by P1 (Wallet Developer).
// ============================================================================

<<<<<<< HEAD
contract Deploy is Script {
    function run() external {
        // Anvil default account #0 (Owner): 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
        // Anvil default account #1 (Agent): 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
        uint256 deployerPrivateKey = vm.envOr(
            "OWNER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address ownerAddress = vm.addr(deployerPrivateKey);

        uint256 agentPrivateKey = vm.envOr(
            "AGENT_PRIVATE_KEY",
            uint256(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)
        );
        address agentAddress = vm.addr(agentPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy EntryPoint v0.8
        EntryPoint entryPoint = new EntryPoint();
        console2.log("EntryPoint deployed at:", address(entryPoint));

        // 2. Deploy AgentWallet
        AgentWallet wallet = new AgentWallet(entryPoint, ownerAddress);
        console2.log("AgentWallet deployed at:", address(wallet));

        // 3. Deploy MockMerchant
        MockMerchant merchant = new MockMerchant();
        console2.log("MockMerchant deployed at:", address(merchant));

        // 4. Configure Agent and Policy
        uint48 validUntil = uint48(block.timestamp + 30 days);
        wallet.setAgent(
            agentAddress,
            AgentWallet.Policy({
                maxPerTx: 0.05 ether,
                dailyLimit: 0.1 ether,
                validUntil: validUntil
            })
        );
        console2.log("Agent set:", agentAddress);

        // 5. Allow MockMerchant.buyCredits
        wallet.setAllowedTarget(address(merchant), MockMerchant.buyCredits.selector, true);
        console2.log("MockMerchant.buyCredits allowed for agent");

        // 6. Fund the wallet and deposit gas prefund to EntryPoint
        (bool fundSuccess, ) = payable(address(wallet)).call{value: 2 ether}("");
        require(fundSuccess, "Failed to fund wallet");

        entryPoint.depositTo{value: 1 ether}(address(wallet));
        console2.log("Wallet funded with 2 ETH and 1 ETH deposited to EntryPoint");

        vm.stopBroadcast();

        // 7. Write addresses to shared/addresses.json
        string memory json = string.concat(
            '{\n',
            '  "chainId": 31337,\n',
            '  "entryPoint": "', vm.toString(address(entryPoint)), '",\n',
            '  "wallet": "', vm.toString(address(wallet)), '",\n',
            '  "merchant": "', vm.toString(address(merchant)), '",\n',
            '  "owner": "', vm.toString(ownerAddress), '",\n',
            '  "agent": "', vm.toString(agentAddress), '",\n',
            '  "goodRecipient": "', vm.toString(address(merchant)), '"\n',
            '}\n'
        );
        vm.writeFile("../shared/addresses.json", json);
        console2.log("Saved deployed addresses to shared/addresses.json");
=======
import {Script, console} from "forge-std/Script.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {AgentPaymaster} from "../src/AgentPaymaster.sol";
import {MockMerchant} from "../src/MockMerchant.sol";

/// @notice Deploys AgentWallet + MockMerchant to a local anvil chain.
///         Run with: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
///
/// Required env vars (from .env, test keys only):
///   OWNER_PRIVATE_KEY   — deployer / owner key
///   AGENT_PRIVATE_KEY   — agent key (address derived from this)
contract Deploy is Script {
    function run() external {
        require(block.chainid == 31337, "Local chain only");

        uint256 ownerKey = vm.envUint("OWNER_PRIVATE_KEY");
        uint256 agentKey = vm.envUint("AGENT_PRIVATE_KEY");
        address entryPointAddress = vm.envAddress("ENTRYPOINT_ADDRESS");

        address ownerAddr = vm.addr(ownerKey);
        address agentAddr = vm.addr(agentKey);

        console.log("Owner :", ownerAddr);
        console.log("Agent :", agentAddr);

        vm.startBroadcast(ownerKey);

        // 1. Deploy AgentWallet
        AgentWallet wallet = new AgentWallet(ownerAddr);
        console.log("AgentWallet:", address(wallet));
        wallet.setEntryPoint(entryPointAddress);
        console.log("EntryPoint  :", entryPointAddress);

        // 2. Deploy and fund the ERC-4337 paymaster.
        AgentPaymaster paymaster = new AgentPaymaster(ownerAddr, entryPointAddress);
        paymaster.setAgentGasQuota(agentAddr, 2_000_000);
        paymaster.addStake{value: 1 ether}(1 days);
        paymaster.deposit{value: 0.1 ether}();
        console.log("Paymaster   :", address(paymaster));

        // 3. Deploy MockMerchant
        MockMerchant merchant = new MockMerchant();
        console.log("MockMerchant:", address(merchant));

        // 4. Fund the wallet with 1 ETH for demo
        (bool ok,) = address(wallet).call{value: 1 ether}("");
        require(ok, "Fund failed");

        // 5. Set up policy: 0.05 ETH per tx, 0.2 ETH daily, valid 24 hours
        AgentWallet.Policy memory policy = AgentWallet.Policy({
            maxPerTx:   0.05 ether,
            dailyLimit: 0.2 ether,
            validUntil: uint48(block.timestamp + 24 hours)
        });

        // 6. Set agent key with policy. Arbitrary merchant/router calls stay blocked.
        wallet.setAgent(agentAddr, policy);
        paymaster.setWalletAgent(address(wallet), agentAddr);

        vm.stopBroadcast();

        console.log("--- Deployment complete ---");
        console.log("chainId     :", block.chainid);
        console.log("wallet      :", address(wallet));
        console.log("paymaster   :", address(paymaster));
        console.log("merchant    :", address(merchant));
        console.log("agent       :", agentAddr);
        console.log("maxPerTx    : 0.05 ETH");
        console.log("dailyLimit  : 0.2 ETH");
>>>>>>> 208cfa56c0595574b5269c3b0c062c06ab6c4bdb
    }
}
