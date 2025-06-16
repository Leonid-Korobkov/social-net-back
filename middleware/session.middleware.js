// import UAParser from 'ua-parser-js';
// import { lookup } from 'geoip-lite';
// import { setSession, getSession, updateSessionActivity } from '../services/redis.service';
// import { v4 as uuidv4 } from 'uuid';

// const sessionMiddleware = async (req, res, next) => {
//   try {
//     const sessionId = req.cookies.sessionId || req.headers['x-session-id'];
    
//     if (!sessionId) {
//       // Создание новой сессии, если она не существует
//       const newSessionId = uuidv4();
//       const userAgent = new UAParser(req.headers['user-agent']);
//       const ip = req.ip || req.connection.remoteAddress;
//       const geo = lookup(ip);

//       const sessionData = {
//         sessionId: newSessionId,
//         userId: req.user?.id || null,
//         browser: userAgent.getBrowser().name,
//         browserVersion: userAgent.getBrowser().version,
//         os: userAgent.getOS().name,
//         device: userAgent.getDevice().type || 'desktop',
//         ipAddress: ip,
//         location: {
//           country: geo?.country || 'Неизвестно',
//           city: geo?.city || 'Неизвестно',
//           region: geo?.region || 'Неизвестно'
//         },
//         timestamp: new Date().toISOString(),
//         lastActivity: new Date().toISOString()
//       };

//       console.log(sessionData)
//       await setSession(newSessionId, sessionData);
//       res.cookie('sessionId', newSessionId, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         maxAge: 86400000 // 24 часа
//       });

//       req.session = sessionData;
//     } else {
//       // Проверка существующей сессии
//       const session = await getSession(sessionId);
      
//       if (!session) {
//         return res.status(401).json({ message: 'Недействительная сессия' });
//       }

//       // Обновление времени последней активности
//       await updateSessionActivity(sessionId);
//       req.session = session;
//     }

//     next();
//   } catch (error) {
//     console.error('Ошибка middleware сессии:', error);
//     res.status(500).json({ message: 'Внутренняя ошибка сервера' });
//   }
// };

// export default sessionMiddleware; 