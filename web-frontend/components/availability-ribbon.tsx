import { ClockIcon, EquipmentIcon, LaboratoryIcon, RoomIcon } from "./icons";

const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"] as const;

const resources = [
  {
    name: "Study room A101",
    detail: "6 seats · Building A",
    icon: RoomIcon,
    slots: ["busy", "open", "open", "busy", "busy", "open"],
  },
  {
    name: "Biology lab B204",
    detail: "24 seats · Staff approval",
    icon: LaboratoryIcon,
    slots: ["busy", "busy", "open", "open", "busy", "busy"],
  },
  {
    name: "Projector kit P-12",
    detail: "Portable equipment",
    icon: EquipmentIcon,
    slots: ["open", "open", "busy", "busy", "open", "open"],
  },
] as const;

export function AvailabilityRibbon() {
  return (
    <div className="availability" aria-label="Example campus availability">
      <div className="availability__topbar">
        <div>
          <p className="availability__eyebrow">Example schedule</p>
          <p className="availability__date">Tuesday, 16 September</p>
        </div>
        <span className="availability__preview">
          Preview
        </span>
      </div>

      <div className="availability__timeline" aria-hidden="true">
        <span />
        {times.map((time) => (
          <time key={time}>{time}</time>
        ))}
      </div>

      <div className="availability__rows">
        {resources.map(({ name, detail, icon: Icon, slots }, resourceIndex) => (
          <div
            className="availability__row"
            key={name}
            role="group"
            aria-label={`${name} availability`}
          >
            <div className="availability__resource">
              <span className="availability__icon">
                <Icon width={19} height={19} />
              </span>
              <span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </span>
            </div>
            <div className="availability__slots" role="list" aria-label="Time slots">
              {slots.map((status, slotIndex) => {
                const label = status === "open" ? "Available" : "Booked";

                return (
                  <span
                    className={`availability__slot availability__slot--${status}`}
                    key={`${resourceIndex}-${slotIndex}`}
                    role="listitem"
                    aria-label={`${times[slotIndex]}: ${label}`}
                    title={`${times[slotIndex]} — ${label}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="availability__legend" aria-label="Schedule legend">
        <span><i className="availability__legend-swatch availability__legend-swatch--open" /> Available</span>
        <span><i className="availability__legend-swatch availability__legend-swatch--booked" /> Booked</span>
      </div>

      <div className="availability__selection">
        <span className="availability__selection-icon">
          <ClockIcon width={20} height={20} />
        </span>
        <span>
          <small>Next available</small>
          <strong>A101 · 10:00–12:00</strong>
        </span>
        <span className="availability__status">Open</span>
      </div>
    </div>
  );
}
