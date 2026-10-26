import { createRemindersHandler } from '../../server/httpHandlers.js';
import { schedulerDependencies } from '../../server/runtime.js';

export default createRemindersHandler(schedulerDependencies);
