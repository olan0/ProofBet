import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getBetFactoryContract, getTrustScoreContract } from '../blockchain/contracts';

const FIELDS = [
  { key: 'proofCollateralUsdc',          label: 'USDC Collateral',  fn: 'setProofCollateralUsdc',          read: 'proofCollateralUsdc',          decimals: 6,  unit: 'USDC'  },
  { key: 'creationFeeProof',             label: 'Creation Fee',     fn: 'setCreationFee',                  read: 'creationFeeProof',             decimals: 18, unit: 'PROOF' },
  { key: 'privateBetFeeProof',           label: 'Private Bet Fee',  fn: 'setPrivateBetFee',                read: 'privateBetFeeProof',           decimals: 18, unit: 'PROOF' },
  { key: 'voteStakeAmountProof',         label: 'Vote Stake',       fn: 'setVoteStakeAmount',              read: 'voteStakeAmountProof',         decimals: 18, unit: 'PROOF' },
  { key: 'maxActiveBetsPerUser',         label: 'Max Active Bets',  fn: 'setMaxActiveBetsPerUser',         read: 'maxActiveBetsPerUser',         decimals: 0,  unit: ''      },
  { key: 'defaultVoterRewardPercentage', label: 'Voter Reward',     fn: 'setDefaultVoterRewardPercentage', read: 'defaultVoterRewardPercentage', decimals: 0,  unit: '%'     },
  { key: 'defaultPlatformFeePercentage', label: 'Platform Fee',     fn: 'setDefaultPlatformFeePercentage', read: 'defaultPlatformFeePercentage', decimals: 0,  unit: '%'     },
  { key: 'baseDurationDays',             label: 'Base Duration',    fn: 'setBaseDurationDays',             read: 'baseDurationDays',             decimals: 0,  unit: 'days'  },
];

const ADDRESS_ACTIONS = [
  { key: 'feeCollector', label: 'Fee Collector',      fn: 'setFeeCollector'     },
  { key: 'betImpl',      label: 'Bet Implementation', fn: 'setBetImplementation' },
  { key: 'unban',        label: 'Unban Creator',       fn: 'unbanCreator'        },
];

function fmt(value, decimals) {
  if (value == null) return '…';
  if (decimals === 0) return value.toString();
  return ethers.formatUnits(value, decimals);
}

export default function AdminControlPanel() {
  const [currentValues, setCurrentValues] = useState({});
  const [inputs, setInputs] = useState({});
  const [loading, setLoading] = useState({});
  const [status, setStatus] = useState({});
  const [banThreshold, setBanThresholdValue] = useState(null);

  const loadValues = useCallback(async () => {
    try {
      const factory = getBetFactoryContract();
      const results = await Promise.allSettled(FIELDS.map(f => factory[f.read]()));
      const vals = {};
      FIELDS.forEach((f, i) => { vals[f.key] = results[i].status === 'fulfilled' ? results[i].value : null; });
      setCurrentValues(vals);
    } catch (err) { console.error('Failed to load admin values:', err); }

    try {
      const ts = getTrustScoreContract();
      const val = await ts.banThreshold();
      setBanThresholdValue(Number(val));
    } catch (err) { console.error('Failed to load trust score values:', err); }
  }, []);

  useEffect(() => { loadValues(); }, [loadValues]);

  const call = async (fn, value, key, parseAs) => {
    if (!value) return;
    setLoading(l => ({ ...l, [key]: true }));
    setStatus(s => ({ ...s, [key]: '' }));
    try {
      const factory = getBetFactoryContract(true);
      const arg = parseAs === 'address' ? value
        : parseAs === 0 ? BigInt(value)
        : ethers.parseUnits(value, parseAs);
      const tx = await factory[fn](arg);
      await tx.wait();
      setStatus(s => ({ ...s, [key]: '✓' }));
      setInputs(i => ({ ...i, [key]: '' }));
      await loadValues();
    } catch (err) {
      setStatus(s => ({ ...s, [key]: `✗ ${err.reason || err.message}` }));
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  const callTrustScore = async (key) => {
    const raw = inputs[key];
    if (!raw) return;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed >= 0) {
      setStatus(s => ({ ...s, [key]: '✗ Must be a negative number' }));
      return;
    }
    setLoading(l => ({ ...l, [key]: true }));
    setStatus(s => ({ ...s, [key]: '' }));
    try {
      const ts = getTrustScoreContract(true);
      const tx = await ts.setBanThreshold(parsed);
      await tx.wait();
      setStatus(s => ({ ...s, [key]: '✓' }));
      setInputs(i => ({ ...i, [key]: '' }));
      setBanThresholdValue(parsed);
    } catch (err) {
      setStatus(s => ({ ...s, [key]: `✗ ${err.reason || err.message}` }));
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  const row = 'flex items-center gap-2 py-1.5 border-b border-gray-700/50 last:border-0';
  const inp = 'w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs';
  const btn = 'px-2 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs rounded';

  return (
    <div className="space-y-4">
      {/* Numeric settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 bg-gray-900 rounded-lg p-3">
        {FIELDS.map(field => (
          <div key={field.key} className={row}>
            <span className="text-gray-300 text-xs w-32 shrink-0">{field.label}</span>
            <span className="text-cyan-400 font-mono text-xs w-24 shrink-0">
              {fmt(currentValues[field.key], field.decimals)}{field.unit && ` ${field.unit}`}
            </span>
            <input
              type="text"
              placeholder={field.unit || 'value'}
              value={inputs[field.key] || ''}
              onChange={e => setInputs(i => ({ ...i, [field.key]: e.target.value }))}
              className={inp}
            />
            <button
              onClick={() => call(field.fn, inputs[field.key], field.key, field.decimals)}
              disabled={loading[field.key]}
              className={btn}
            >
              {loading[field.key] ? '…' : 'Set'}
            </button>
            {status[field.key] && (
              <span className={`text-xs ${status[field.key].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {status[field.key]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* TrustScore settings */}
      <div className="bg-gray-900 rounded-lg p-3">
        <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wider">Trust Score</p>
        <div className={row}>
          <span className="text-gray-300 text-xs w-32 shrink-0">Ban Threshold</span>
          <span className="text-cyan-400 font-mono text-xs w-24 shrink-0">
            {banThreshold != null ? banThreshold : '…'}
          </span>
          <input
            type="number"
            placeholder="-20"
            value={inputs['banThreshold'] || ''}
            onChange={e => setInputs(i => ({ ...i, banThreshold: e.target.value }))}
            className={inp}
          />
          <button
            onClick={() => callTrustScore('banThreshold')}
            disabled={loading['banThreshold']}
            className={btn}
          >
            {loading['banThreshold'] ? '…' : 'Set'}
          </button>
          {status['banThreshold'] && (
            <span className={`text-xs ${status['banThreshold'].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {status['banThreshold']}
            </span>
          )}
        </div>
      </div>

      {/* Address actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 bg-gray-900 rounded-lg p-3">
        {ADDRESS_ACTIONS.map(({ key, label, fn }) => (
          <div key={key} className={row}>
            <span className="text-gray-300 text-xs w-32 shrink-0">{label}</span>
            <input
              type="text"
              placeholder="0x..."
              value={inputs[key] || ''}
              onChange={e => setInputs(i => ({ ...i, [key]: e.target.value }))}
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs font-mono"
            />
            <button
              onClick={() => call(fn, inputs[key], key, 'address')}
              disabled={loading[key]}
              className={btn}
            >
              {loading[key] ? '…' : 'Set'}
            </button>
            {status[key] && (
              <span className={`text-xs ml-1 ${status[key].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {status[key]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
