import { HttpClient } from '../HttpClient';
import { HttpImportCreateReq, HttpImportListResponse, HttpImportProgressReq } from '../types/Http';

import { BulkImportOptions, ImportJobResponse, ImportProgressResponse, WaitForImportOptions } from './types';

/**
 * Client for bulk import operations using HTTP API.
 * Supports both local files and cloud storage imports.
 */
export class BulkImportClient extends HttpClient {
  /**
   * Create a new bulk import job.
   */
  async createImportJob(options: BulkImportOptions): Promise<ImportJobResponse> {
    const params: HttpImportCreateReq = {
      collectionName: options.collectionName,
      dbName: options.dbName || '',
      partitionName: options.partitionName || '',
      files: options.files || [],
      objectUrl: options.objectUrl || '',
      clusterId: options.clusterId || '',
      accessKey: options.accessKey || '',
      secretKey: options.secretKey || '',
      stageName: options.stageName || '',
      dataPaths: options.dataPaths || [],
      options: options.options || {},
    };

    const response = await this.createImportJobs(params);
    
    if (response.code !== 0) {
      throw new Error(`Import job creation failed: ${response.message}`);
    }

    return {
      jobId: response.data?.jobId || '',
      status: response.status || '',
      message: response.message,
    };
  }

  /**
   * Get the progress of an import job.
   */
  async getImportProgress(jobId: string, clusterId?: string): Promise<ImportProgressResponse> {
    const params: HttpImportProgressReq = {
      jobId,
      clusterId: clusterId || '',
    };

    const response = await this.getImportJobProgress(params);
    
    if (response.code !== 0) {
      throw new Error(`Failed to get import progress: ${response.message}`);
    }

    const data = response.data;
    return {
      jobId: data?.jobId || jobId,
      state: data?.state || '',
      rowCount: data?.rowCount || 0,
      idList: data?.idList || [],
      infos: data?.infos || [],
      collectionId: data?.collectionId || 0,
      segmentIds: data?.segmentIds || [],
      createTs: data?.createTs || 0,
    };
  }

  /**
   * List all import jobs for a collection.
   */
  async listImportJobs(collectionName?: string, clusterId?: string): Promise<ImportProgressResponse[]> {
    const response = await this.listImportJobs({
      collectionName: collectionName || '',
      clusterId: clusterId || '',
    });

    if (response.code !== 0) {
      throw new Error(`Failed to list import jobs: ${response.message}`);
    }

    return (response.data?.jobs || []).map((job: any) => ({
      jobId: job.jobId || '',
      state: job.state || '',
      rowCount: job.rowCount || 0,
      idList: job.idList || [],
      infos: job.infos || [],
      collectionId: job.collectionId || 0,
      segmentIds: job.segmentIds || [],
      createTs: job.createTs || 0,
    }));
  }

  /**
   * Wait for an import job to complete with polling.
   */
  async waitForImportCompletion(options: WaitForImportOptions): Promise<ImportProgressResponse> {
    const { jobId, clusterId, pollInterval = 5000, timeout = 300000 } = options;
    const startTime = Date.now();

    // State evaluation strategies
    const stateEvaluators = {
      'ImportCompleted': (progress: ImportProgressResponse) => progress,
      'ImportFailed': () => { throw new Error('Import job failed: ImportFailed'); },
      'ImportFailedAndCleaned': () => { throw new Error('Import job failed: ImportFailedAndCleaned'); }
    };

    while (true) {
      const progress = await this.getImportProgress(jobId, clusterId);
      
      // Check for terminal states
      const evaluator = stateEvaluators[progress.state as keyof typeof stateEvaluators];
      if (evaluator) {
        return evaluator(progress);
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('Import job timeout');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}
