async function limitConcurrency(tasks, limit) {
    const results = [];
    const executing = [];
    
    for (const task of tasks) {
      const p = task().then(result => {
        executing.splice(executing.indexOf(p), 1);
        results.push(result);
      });
      executing.push(p);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    
    await Promise.all(executing);
    return results;
  }
  
  //main processing function
  async function processFunctions({ text, host, userId, farmId, tokenId, dispositionId }) { // <--- Need to pass disposition ID  
    try {
    
    const overallStartTime = Date.now();

    /********************************************************Get Interactions*****************************************************************/

      self.postMessage({ type: 'log', data: `Getting ${text.split("\n").length} interaction data. Please wait...` });
  
      const startTimeProcess1 = Date.now();
      const CSVArray = text.split("\n");
      CSVArray.shift(); //remove headers
  
      const urlsProcess1 = CSVArray.map((row) => ({
        url: `https://${host}/appsvcs/rs/svc/agents/${userId}/interactions/${row.split(",")[0]}`,
        options: {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            farmId: farmId,
            Authorization: tokenId,
          },
        },
      }));
  
      const tasksProcess1 = urlsProcess1.map(({ url, options }) => async () => {
        try {
          const response = await fetch(url, options);
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          return await response.json();
        } catch (error) {
          self.postMessage({ type: 'log', data: `Error fetching ${url}: ${error.message}` });
          return null;
        }
      });
  
      const resultsProcess1 = await limitConcurrency(tasksProcess1, 100);
  
      const endTimeProcess1 = Date.now();
      const timeTakenProcess1 = endTimeProcess1 - startTimeProcess1;
      const minutesProcess1 = Math.floor(timeTakenProcess1 / 60000);
      const secondsProcess1 = ((timeTakenProcess1 % 60000) / 1000).toFixed(2);
  
      self.postMessage({
        type: 'log',
        data: `[Get Interaction] Completed. Gathered ${resultsProcess1.length} interaction data in ${minutesProcess1} minutes and ${secondsProcess1} seconds.`
      });
  
      /**transform results for Process 2 - something is wrong here with the json structure. Something related when domain is moved to stl from scl original testing.
       * Description: it returns 0 data when checked on the logs, process 2 processes 0 data.
       * 
      */
      const process2Data = resultsProcess1
        .map(
          (data) =>
            data && [
              data.id,
              data.profileId,
              data.mediaType,
              dispositionId,
            ]
        )
        .filter((entry) => entry && entry[0]);

    /********************************************************ACCEPT INTERACTIONS*****************************************************************/

      self.postMessage({ type: 'log', data: `Now accepting ${process2Data.length} interactions. Please wait...` });
  
      const startTimeProcess2 = Date.now();
  
      const urlsProcess2 = process2Data.map((x) => ({
        url: `https://${host}/appsvcs/rs/svc/agents/${userId}/interactions/${x[0]}/accept`,
        options: {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            farmId: farmId,
            Authorization: tokenId,
          },
          body: JSON.stringify({
            profileId: x[1],
            mediaType: x[2],
            type: 1,
          }),
        },
      }));
  
      const tasksProcess2 = urlsProcess2.map(({ url, options }, index) => async () => {
        try {
          const response = await fetch(url, options);
          if (!response.ok) return `HTTP Error: ${response.status}`;
          return await `done`;
        } catch (error) {
          self.postMessage({ type: 'log', data: `Error #${index}, when fetching ${url}: ${error.message}` });
          return [index,error.message];
        }
      });
  
      const resultsProcess2 = await limitConcurrency(tasksProcess2, 100);
  
      const endTimeProcess2 = Date.now();
      const timeTakenProcess2 = endTimeProcess2 - startTimeProcess2;
      const minutesProcess2 = Math.floor(timeTakenProcess2 / 60000);
      const secondsProcess2 = ((timeTakenProcess2 % 60000) / 1000).toFixed(2);
  
      self.postMessage({
        type: 'log',
        data: `[Accept Interaction] Completed. Accepted ${resultsProcess2.length} interactions in ${minutesProcess2} minutes and ${secondsProcess2} seconds.`
      });

      /********************************************************DISPOSE INTERACTIONS*****************************************************************/

      //Process 3 building (dispose interaction API)

      //still use the same data (accept api)
      self.postMessage({ type: 'log', data: `Now disposing ${process2Data.length} interactions. Please wait...` }); 

      const startTimeProcess3 = Date.now();

      const urlsProcess3 = process2Data.map((x) => ({
        url: `https://${host}/appsvcs/rs/svc/agents/${userId}/interactions/${x[0]}/disposition`,
        options: {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            farmId: farmId,
            Authorization: tokenId,
          },
          body: JSON.stringify({
            profileId: x[1],
            mediaType: x[2],
            dispositionId: x[3],
            isClose: 1,
          }),
        },
      }));

      const tasksProcess3 = urlsProcess3.map(({ url, options }, index) => async () => {
        try {
          const response = await fetch(url, options);
          if (!response.ok)
          {
            if (response.status === 435) {
                const errorData = await response.json(); 
                return errorData.five9ExceptionDetail.message
              }else{
                return response.message;
              }
          }
          return await `done`;
        } catch (error) {
          self.postMessage({ type: 'log', data: `Error #${index}, when fetching ${url}: ${error.message}` });
          return [index,error.message];
        }
      });

      const resultsProcess3 = await limitConcurrency(tasksProcess3, 100);
  
      const endTimeProcess3 = Date.now();
      const timeTakenProcess3 = endTimeProcess3 - startTimeProcess3;
      const minutesProcess3 = Math.floor(timeTakenProcess3 / 60000);
      const secondsProcess3 = ((timeTakenProcess3 % 60000) / 1000).toFixed(2);
  
      self.postMessage({
        type: 'log',
        data: `[Dispose Interaction] Completed. Disposed ${resultsProcess3.length} interactions in ${(minutesProcess1 + minutesProcess2 + minutesProcess3)} minutes and ${secondsProcess1 + secondsProcess2 + secondsProcess3} seconds.`
      });

      /********************************************************DISPOSE*****************************************************************/
  
      const totalTimeTaken = endTimeProcess3 - overallStartTime;
      const totalMinutes = Math.floor(totalTimeTaken / 60000);
      const totalSeconds = ((totalTimeTaken % 60000) / 1000).toFixed(2);
  
      self.postMessage({
        type: 'log',
        data: `[Finished]\n The tool has processed ${resultsProcess3.length} interaction(s) in ${totalMinutes} minutes and ${totalSeconds} seconds.`
      });
  
      //send final result back to main thread
      self.postMessage({ type: 'result', data: { resultsProcess1, resultsProcess2, resultsProcess3 } });
    } catch (error) {
      self.postMessage({ type: 'error', data: `Error in processFunctions: ${error.message}` });
    }
  }
  
  //listen for messages from the main thread
  self.onmessage = function (event) {
    const config = event.data;
    processFunctions(config); //start processing with the received data
  };  