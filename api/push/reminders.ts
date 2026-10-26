import { createRemindersHandler } from '../../server/httpHandlers';
import { schedulerDependencies } from '../../server/runtime';

export default createRemindersHandler(schedulerDependencies);
