/** Identité invité persistée localement (upgradable en compte plus tard). */

const ID_KEY = 'pixrunner.guestId';
const NAME_KEY = 'pixrunner.guestName';

export interface GuestIdentity {
  guestId: string;
  name: string;
}

export function getGuestIdentity(): GuestIdentity {
  let guestId = localStorage.getItem(ID_KEY);
  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem(ID_KEY, guestId);
  }
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = `Coureur ${guestId.slice(0, 4)}`;
    localStorage.setItem(NAME_KEY, name);
  }
  return { guestId, name };
}
