import { getBetTypeLabel } from '../../i18n/th/labels';

const MemberLotterySettingsStep = ({
  groupedLotteries,
  lotteryCopy,
  profileCopy,
  betTypeKeys,
  customRateBetTypesByLottery,
  patchLottery,
  toggleBetTypeForLottery
}) => (
  <div className="lottery-groups">
    {Object.entries(groupedLotteries).map(([leagueName, items]) => (
      <div key={leagueName} className="lottery-group">
        <div className="lottery-group-title">{leagueName}</div>
        {items.map((lottery) => (
          <div key={lottery.lotteryTypeId} className={`lottery-card ${lottery.isEnabled ? '' : 'muted'}`}>
            <div className="lottery-card-header">
              <div>
                <strong>{lottery.lotteryName}</strong>
                <span>{lottery.lotteryCode}</span>
              </div>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={lottery.isEnabled}
                  onChange={(event) => patchLottery(lottery.lotteryTypeId, { isEnabled: event.target.checked })}
                />
                {lotteryCopy.enabled}
              </label>
            </div>

            <div className="wizard-grid">
              <label>
                <span>{lotteryCopy.rateProfile}</span>
                <select value={lottery.rateProfileId} onChange={(event) => patchLottery(lottery.lotteryTypeId, { rateProfileId: event.target.value })}>
                  {lottery.availableRateProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{lotteryCopy.minimumBet}</span>
                <input type="number" min="0" value={lottery.minimumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { minimumBet: event.target.value })} />
              </label>
              <label>
                <span>{lotteryCopy.maximumBet}</span>
                <input type="number" min="0" value={lottery.maximumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumBet: event.target.value })} />
              </label>
              <label>
                <span>{lotteryCopy.maximumPerNumber}</span>
                <input type="number" min="0" value={lottery.maximumPerNumber} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumPerNumber: event.target.value })} />
              </label>
              <label>
                <span>{profileCopy.stockPercent}</span>
                <input type="number" min="0" max="100" value={lottery.stockPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { stockPercent: event.target.value })} />
              </label>
              <label>
                <span>{profileCopy.ownerPercent}</span>
                <input type="number" min="0" max="100" value={lottery.ownerPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { ownerPercent: event.target.value })} />
              </label>
              <label>
                <span>{profileCopy.keepPercent}</span>
                <input type="number" min="0" max="100" value={lottery.keepPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepPercent: event.target.value })} />
              </label>
              <label>
                <span>{profileCopy.commissionRate}</span>
                <input type="number" min="0" max="100" value={lottery.commissionRate} onChange={(event) => patchLottery(lottery.lotteryTypeId, { commissionRate: event.target.value })} />
              </label>
              <label>
                <span>{lotteryCopy.keepMode}</span>
                <select value={lottery.keepMode} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepMode: event.target.value })}>
                  <option value="off">{lotteryCopy.keepModes.off}</option>
                  <option value="cap">{lotteryCopy.keepModes.cap}</option>
                </select>
              </label>
              <label>
                <span>{lotteryCopy.keepCapAmount}</span>
                <input type="number" min="0" value={lottery.keepCapAmount} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepCapAmount: event.target.value })} />
              </label>
            </div>

            <div className="bet-type-row">
              {lottery.supportedBetTypes.map((betType) => (
                <button
                  key={betType}
                  type="button"
                  className={`bet-chip ${lottery.enabledBetTypes.includes(betType) ? 'active' : ''}`}
                  onClick={() => toggleBetTypeForLottery(lottery.lotteryTypeId, betType)}
                >
                  {getBetTypeLabel(betType)}
                </button>
              ))}
            </div>

            <div className="lottery-advanced-row">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={lottery.useCustomRates}
                  onChange={(event) => patchLottery(lottery.lotteryTypeId, { useCustomRates: event.target.checked })}
                />
                {lotteryCopy.customRates}
              </label>
            </div>

            {lottery.useCustomRates && (
              <div className="wizard-grid">
                {(typeof customRateBetTypesByLottery === 'function'
                  ? customRateBetTypesByLottery(lottery, betTypeKeys)
                  : betTypeKeys
                ).map((betType) => (
                  <label key={betType}>
                    <span>{getBetTypeLabel(betType)}</span>
                    <input
                      type="number"
                      min="0"
                      value={lottery.customRates?.[betType] || 0}
                      onChange={(event) => patchLottery(lottery.lotteryTypeId, {
                        customRates: {
                          ...lottery.customRates,
                          [betType]: event.target.value
                        }
                      })}
                    />
                  </label>
                ))}
              </div>
            )}

            <label className="wizard-grid-textarea">
              <span>{lotteryCopy.blockedNumbers}</span>
              <textarea
                rows="3"
                value={(lottery.blockedNumbers || []).join('\n')}
                onChange={(event) => patchLottery(lottery.lotteryTypeId, {
                  blockedNumbers: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
                })}
                placeholder={lotteryCopy.blockedNumbersPlaceholder}
              />
            </label>
          </div>
        ))}
      </div>
    ))}
  </div>
);

export default MemberLotterySettingsStep;
