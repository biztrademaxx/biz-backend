import prisma from "../../config/prisma";
import { ConnectionStatus } from "@prisma/client";
import { resolveUserCityCountry } from "../../utils/profile-location";

const connectionUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true,
  role: true,
  company: true,
  jobTitle: true,
  lastLogin: true,
  profileCity: true,
  profileState: true,
  profileCountry: true,
  organizerCity: true,
  organizerState: true,
  organizerCountry: true,
  location: true,
  headquarters: true,
} as const;

function mapConnectionUser(other: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatar: string | null;
  role: string;
  company: string | null;
  jobTitle: string | null;
  lastLogin?: Date | null;
  profileCity?: string | null;
  profileState?: string | null;
  profileCountry?: string | null;
  organizerCity?: string | null;
  organizerState?: string | null;
  organizerCountry?: string | null;
  location?: string | null;
  headquarters?: string | null;
}) {
  const loc = resolveUserCityCountry(other);
  return {
    firstName: other.firstName,
    lastName: other.lastName,
    email: other.email ?? undefined,
    avatar: other.avatar ?? undefined,
    role: other.role,
    company: other.company ?? undefined,
    jobTitle: other.jobTitle ?? undefined,
    lastLogin: other.lastLogin?.toISOString() ?? undefined,
    profileCity: other.profileCity ?? undefined,
    profileCountry: other.profileCountry ?? undefined,
    city: loc.city || undefined,
    country: loc.country || undefined,
    locationDisplay: loc.display || undefined,
  };
}

// ─── List connections (accepted + pending outgoing) for the current user ──────
export async function listConnections(userId: string) {
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { status: ConnectionStatus.ACCEPTED, OR: [{ requesterId: userId }, { receiverId: userId }] },
        { status: ConnectionStatus.PENDING, requesterId: userId },
      ],
    },
    include: {
      requester: { select: connectionUserSelect },
      receiver: { select: connectionUserSelect },
    },
    orderBy: { updatedAt: "desc" },
  });

  return connections.map((c) => {
    const other = c.requesterId === userId ? c.receiver : c.requester;
    const status =
      c.status === ConnectionStatus.ACCEPTED
        ? "connected"
        : c.status === ConnectionStatus.PENDING && c.requesterId === userId
          ? "pending"
          : "connected";
    const mapped = other ? mapConnectionUser(other) : null;
    return {
      connectionId: c.id,
      id: other?.id ?? c.id,
      status,
      requesterId: c.requesterId,
      receiverId: c.receiverId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      firstName: mapped?.firstName ?? other?.firstName ?? "",
      lastName: mapped?.lastName ?? other?.lastName ?? "",
      email: mapped?.email,
      avatar: mapped?.avatar,
      role: mapped?.role ?? other?.role,
      company: mapped?.company,
      jobTitle: mapped?.jobTitle,
      lastLogin: mapped?.lastLogin,
      profileCity: mapped?.profileCity,
      profileCountry: mapped?.profileCountry,
      city: mapped?.city,
      country: mapped?.country,
      locationDisplay: mapped?.locationDisplay,
    };
  });
}

// ─── List pending connection requests (received by current user) ─────────────
export async function listConnectionRequests(userId: string) {
  const connections = await prisma.connection.findMany({
    where: {
      receiverId: userId,
      status: ConnectionStatus.PENDING,
    },
    include: {
      requester: { select: connectionUserSelect },
    },
    orderBy: { createdAt: "desc" },
  });

  return connections.map((c) => {
    const mapped = mapConnectionUser(c.requester);
    return {
      id: c.requester.id,
      connectionId: c.id,
      status: "request_received",
      requesterId: c.requesterId,
      receiverId: c.receiverId,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      email: mapped.email,
      avatar: mapped.avatar,
      role: mapped.role,
      company: mapped.company,
      jobTitle: mapped.jobTitle,
      profileCity: mapped.profileCity,
      profileCountry: mapped.profileCountry,
      city: mapped.city,
      country: mapped.country,
      locationDisplay: mapped.locationDisplay,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

// ─── Send connection request ───────────────────────────────────────────────
export async function requestConnection(requesterId: string, receiverId: string) {
  if (requesterId === receiverId) {
    throw new Error("Cannot send connection request to yourself");
  }

  const [requester, receiver] = await Promise.all([
    prisma.user.findUnique({ where: { id: requesterId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } }),
  ]);

  if (!requester) throw new Error("Requester not found");
  if (!receiver) throw new Error("Receiver not found");

  const existing = await prisma.connection.findUnique({
    where: {
      requesterId_receiverId: {
        requesterId: requesterId,
        receiverId: receiverId,
      },
    },
  });

  if (existing) {
    if (existing.status === ConnectionStatus.PENDING) {
      throw new Error("Connection request already sent");
    }
    if (existing.status === ConnectionStatus.ACCEPTED) {
      throw new Error("Already connected");
    }
    if (existing.status === ConnectionStatus.REJECTED || existing.status === ConnectionStatus.BLOCKED) {
      throw new Error("Cannot send request to this user");
    }
  }

  // Check reverse direction (receiver might have sent request to requester)
  const reverse = await prisma.connection.findUnique({
    where: {
      requesterId_receiverId: {
        requesterId: receiverId,
        receiverId: requesterId,
      },
    },
  });
  if (reverse?.status === ConnectionStatus.PENDING) {
    throw new Error("This user has already sent you a connection request. Accept it instead.");
  }
  if (reverse?.status === ConnectionStatus.ACCEPTED) {
    throw new Error("Already connected");
  }

  const connection = await prisma.connection.create({
    data: {
      requesterId,
      receiverId,
      status: ConnectionStatus.PENDING,
    },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          company: true,
          jobTitle: true,
        },
      },
      receiver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          company: true,
          jobTitle: true,
        },
      },
    },
  });

  return {
    connection: {
      id: connection.receiver.id,
      connectionId: connection.id,
      status: "pending",
      requesterId: connection.requesterId,
      receiverId: connection.receiverId,
      firstName: connection.receiver.firstName,
      lastName: connection.receiver.lastName,
      email: connection.receiver.email ?? undefined,
      avatar: connection.receiver.avatar ?? undefined,
      role: connection.receiver.role,
      company: connection.receiver.company ?? undefined,
      jobTitle: connection.receiver.jobTitle ?? undefined,
      createdAt: connection.createdAt.toISOString(),
    },
  };
}

// ─── Accept connection request ─────────────────────────────────────────────
export async function acceptConnection(connectionId: string, userId: string) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== userId) {
    throw new Error("Only the receiver can accept the request");
  }
  if (connection.status !== ConnectionStatus.PENDING) {
    throw new Error("Connection is not pending");
  }

  const updated = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: ConnectionStatus.ACCEPTED },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          company: true,
          jobTitle: true,
        },
      },
      receiver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          role: true,
          company: true,
          jobTitle: true,
        },
      },
    },
  });

  return {
    connection: {
      id: updated.id,
      connectionId: updated.id,
      status: "connected",
      requesterId: updated.requesterId,
      receiverId: updated.receiverId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      requester: updated.requester,
      receiver: updated.receiver,
    },
  };
}

// ─── Reject connection request ─────────────────────────────────────────────
export async function rejectConnection(connectionId: string, userId: string) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.receiverId !== userId) {
    throw new Error("Only the receiver can reject the request");
  }
  if (connection.status !== ConnectionStatus.PENDING) {
    throw new Error("Connection is not pending");
  }

  await prisma.connection.update({
    where: { id: connectionId },
    data: { status: ConnectionStatus.REJECTED },
  });

  return { success: true };
}

// ─── Delete / cancel connection ────────────────────────────────────────────
export async function deleteConnection(connectionId: string, userId: string) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection not found");
  if (connection.requesterId !== userId && connection.receiverId !== userId) {
    throw new Error("You can only remove your own connections");
  }

  await prisma.connection.delete({
    where: { id: connectionId },
  });

  return { success: true };
}
