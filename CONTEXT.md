# Mini Trip Management System

Domain glossary for a system that manages trips, the participants who join them, and each participant's registration and payment status for a given trip.

## Language

**Trip**:
A scheduled journey with a destination, a date range, and a maximum number of Participants it can hold (its Capacity).
_Avoid_: Tour, package, event

**Participant**:
A person who can be registered onto one or more Trips. Identified primarily by their IC/passport number. Exists independently of any single Trip.
_Avoid_: Traveler, customer

**Registration**:
The record of a Participant joining a specific Trip. Carries that joining's Payment Status and Registration Status. A Participant may hold separate Registrations for different Trips, but at most one Registration per Trip.
_Avoid_: Booking, enrollment, signup

**Capacity**:
The maximum number of counted Registrations a Trip can hold. Every Registration counts against Capacity unless its Registration Status is Cancelled.
_Avoid_: Limit, quota

**Payment Status**:
Whether a Registration has been paid for: Unpaid, Paid, or Refunded. Tracked independently of Registration Status. Can be set directly by a User, or set to Paid automatically when a Payment Link is completed.

**Payment Link**:
An optional, Staff- or Admin-initiated invitation emailed to a Participant, prompting them to pay a Registration's price online. Sending one is never required — a Registration's Payment Status can always be set directly instead. Completing a Payment Link always sets Payment Status to Paid, even overriding a Payment Status set manually in the meantime. A Registration records which User last sent a Payment Link and when, separately from the Activity Log.
_Avoid_: Invoice, checkout link

**Registration Status**:
Whether a Registration is active: Registered or Cancelled. Cancelling a Registration frees its slot against the Trip's Capacity.

**Activity Log**:
A record of a change to a Registration's Payment Status or Registration Status, kept for history purposes.
_Avoid_: Audit trail, history

**Admin**:
A User role that can manage Trips (create, edit, delete) and manage Staff accounts, in addition to everything a Staff can do.

**Staff**:
A User role that can view/search Trips, register Participants onto Trips, and view/search Participants and Registrations. Cannot manage Trips or Staff accounts.

**User**:
A person with a login to the system, assigned either the Admin or Staff role.

**Revoke Access**:
Removing a Staff User's role so they can no longer log into the system. Does not delete the underlying account. A revoked User becomes Unassigned; assigning them a role again restores their access. The system has no action that permanently deletes a User's account.
_Avoid_: Delete, remove, deactivate

**Unassigned**:
A User whose account exists but has no Admin or Staff role, either because a Staff User's access was revoked or because a role was never assigned. Cannot log into the system.
