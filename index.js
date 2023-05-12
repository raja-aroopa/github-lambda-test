const jwt_decode = require("jwt-decode");

const mysql				= require( 'mysql' );

const headers			= { "Content-Type": "application/json" };
const INVALID_REQUEST	= 'Invalid Request.';
const DB_NAME			= 'crush';

const return_error		= ( message )	=> { return { statusCode: 400, body: message, headers: headers }; };
const return_results	= ( data )		=> { return { statusCode: 200, body: data, headers: headers }; };

const execute_query = async( db, event, sql_statement, parameters ) =>
{
	const connection = mysql.createConnection( { host: process.env.RDS_LAMBDA_HOSTNAME, user: process.env.RDS_LAMBDA_USERNAME, password: process.env.RDS_LAMBDA_PASSWORD, port: process.env.RDS_LAMBDA_PORT, database: db } );

	try
	{
		const data = await new Promise( ( resolve, reject ) =>
		{
			connection.connect( function( err )
			{
				if( err )
				{
					connection.end( function()
					{
						console.log('Connection End')
						reject( err );
					} );
				}
				else
				{
					connection.query
					(
						sql_statement,
						parameters,
						function( err, result )
						{
							if( err )
							{
								connection.end( function()
								{
									reject( err );
								} );
							}
							else
							{
								if(event.httpMethod==="POST" || event.httpMethod=="post"){
									console.log('Result ',event.httpMethod,result)
								}
								connection.end( function()
								{
									resolve( result );
								} );
							}
						}
					);
				}

			} );
		} );

		return return_results( JSON.stringify( data ) );
	}
	catch( err )
	{
		console.log('Execute url:', err );

		return return_error( err.message );
	}
};

exports.handler = async( event ) =>
{
	let		user_id			= event.requestContext.authorizer.claims.sub;
	let	email			= event.requestContext.authorizer.claims.email;
	const	body			= JSON.parse( event.body );
	const	pathParameters	= event.pathParameters;
	let		sql_statement	= '';
	

	console.log('Previous User:',user_id,'--',email)
	console.log('Body',JSON.stringify(body))
	
	// console.log('Token',token)
	try
	{
		let token = event.headers['Authorization'];
		if(token && token!==""){
			
			let decoded = jwt_decode(token);
			console.log('Decode Token',decoded);
			
			console.log('Matching is sub matched: ',user_id===decoded['sub'])
			console.log('Matching is email: ',email===decoded['email'])

			user_id  = decoded['sub'];
			email = decoded['email']
		}
	} catch(err) {
		console.log('Error in Decode',err)
	}
	
	
	

	switch( event.httpMethod )
	{
		case 'POST':
			{
				// A POST always has to have a body ...
				if( !body ){ return return_error( INVALID_REQUEST ); }

				// If there are pathParameters, we're editing ...
				if( pathParameters ){ return return_error( INVALID_REQUEST ); }

				// Validate get messages request ...
				if( !body.tbl_message_modified ){ return return_error( 'Error, timestamp is required.' ); }

				sql_statement = 'SELECT BIN_TO_UUID( tbl_user_id ) AS tbl_user_id, BIN_TO_UUID( tbl_message_id ) AS tbl_message_id, tbl_message_contents, BIN_TO_UUID( tbl_folder_id ) AS tbl_folder_id, tbl_message_datetime, tbl_message_archived, tbl_message_deleted, tbl_message_status, tbl_message_task_complete, tbl_message_media_url, tbl_message_modified, tbl_message_keep_audio, BIN_TO_UUID( tbl_message_owner ) AS tbl_message_owner, tbl_message_owner_photo_video_url, tbl_message_owner_name, tbl_message_photo_video_url ' +
								'FROM tbl_message ' +
								'WHERE tbl_user_id = UUID_TO_BIN( ? ) AND tbl_message_modified > ? ' +
								'UNION ' +
								'SELECT BIN_TO_UUID( tbl_user_id ) AS tbl_user_id, BIN_TO_UUID( tbl_message_id ) AS tbl_message_id, tbl_message_contents, BIN_TO_UUID( tbl_folder_id ) AS tbl_folder_id, tbl_message_datetime, tbl_message_archived, tbl_message_deleted, tbl_message_status, tbl_message_task_complete, tbl_message_media_url, tbl_message_modified, tbl_message_keep_audio, BIN_TO_UUID( tbl_message_owner ) AS tbl_message_owner, tbl_message_owner_photo_video_url, tbl_message_owner_name, tbl_message_photo_video_url ' +
								'FROM tbl_message ' +
								'WHERE tbl_user_id = UUID_TO_BIN( ? ) AND tbl_message_owner <> UUID_TO_BIN( ? ) ' +
								'UNION ALL ' +
								'SELECT BIN_TO_UUID( tbl_message.tbl_user_id ) AS tbl_user_id, BIN_TO_UUID( tbl_message_id ) AS tbl_message_id, tbl_message_contents, BIN_TO_UUID( tbl_message.tbl_folder_id ) AS tbl_folder_id, tbl_message_datetime, tbl_message_archived, tbl_message_deleted, tbl_message_status, tbl_message_task_complete, tbl_message_media_url, tbl_message_modified, tbl_message_keep_audio, BIN_TO_UUID( tbl_message_owner ) AS tbl_message_owner, tbl_message_owner_photo_video_url, tbl_message_owner_name, tbl_message_photo_video_url ' +
								'FROM tbl_folder_share ' +
								'INNER JOIN tbl_message ON tbl_folder_share.tbl_folder_id = tbl_message.tbl_folder_id AND tbl_folder_share.tbl_user_id = tbl_message.tbl_user_id ' +
								'WHERE tbl_folder_share_email_address = ?';

				         console.log('sql_statement',sql_statement)
						return  await execute_query( DB_NAME, event, sql_statement, [ user_id, body.tbl_message_modified, user_id, user_id, email,user_id ] );
							
			}
		case 'PUT':
			{
				if( !body ){ return return_error( INVALID_REQUEST ); }
				if( !body.messages ){ return return_error( INVALID_REQUEST ); }

				sql_statement = 'INSERT INTO tbl_message( tbl_user_id, tbl_message_id, tbl_message_contents, tbl_folder_id, tbl_message_datetime, tbl_message_archived, tbl_message_deleted, tbl_message_status, tbl_message_task_complete, tbl_message_media_url, tbl_message_modified, tbl_message_keep_audio, tbl_message_owner, tbl_message_owner_photo_video_url, tbl_message_owner_name, tbl_message_photo_video_url ) ' +
					'VALUES ( UUID_TO_BIN( ? ), UUID_TO_BIN( ? ), ?, UUID_TO_BIN( ? ), ?, ?, ?, ?, ?, ?, ?, ?, UUID_TO_BIN( ? ), ?, ?, ? ) ' +
					'ON DUPLICATE KEY UPDATE tbl_message_contents = ?, tbl_folder_id = UUID_TO_BIN( ? ), tbl_message_datetime = ?, tbl_message_archived = ?, tbl_message_deleted = ?, tbl_message_status = ?, tbl_message_task_complete = ?, tbl_message_media_url = ?, tbl_message_modified = ?, tbl_message_keep_audio = ?, tbl_message_owner = UUID_TO_BIN( ? ), tbl_message_owner_photo_video_url = ?, tbl_message_owner_name = ?, tbl_message_photo_video_url = ?';

				// ... add in all messages from mobile device ...
				for( const index in body.messages )
				{
					const	message		= body.messages[index];
					let		owner_id	= user_id;

					// ... if a shared message, place in folder owner's message table ...
					if( ( message.tbl_folder_owner ) && ( message.tbl_folder_owner !== user_id ) )
					{
						owner_id = message.tbl_folder_owner;

						// ... delete, if exists, from "our" message table, as this message is not "ours" anymore ...
						await execute_query( DB_NAME, event, 'DELETE FROM tbl_message WHERE tbl_message_id = UUID_TO_BIN( ? )', [ message.tbl_message_id ] );
					}
					
					await execute_query( DB_NAME, event, sql_statement, [ owner_id,
																message.tbl_message_id,
																message.tbl_message_contents,
																message.tbl_folder_id,
																message.tbl_message_datetime,
																message.tbl_message_archived,
																message.tbl_message_deleted,
																message.tbl_message_status,
																message.tbl_message_task_complete,
																message.tbl_message_media_url,
																message.tbl_message_modified,
																message.tbl_message_keep_audio ? message.tbl_message_keep_audio : 0,
																message.tbl_message_owner,
																message.tbl_message_owner_photo_video_url,
																message.tbl_message_owner_name,
																message.tbl_message_photo_video_url,
																message.tbl_message_contents,
																message.tbl_folder_id,
																message.tbl_message_datetime,
																message.tbl_message_archived,
																message.tbl_message_deleted,
																message.tbl_message_status,
																message.tbl_message_task_complete,
																message.tbl_message_media_url,
																message.tbl_message_modified,
																message.tbl_message_keep_audio ? message.tbl_message_keep_audio : 0,
																message.tbl_message_owner,
																message.tbl_message_owner_photo_video_url,
																message.tbl_message_owner_name,
																message.tbl_message_photo_video_url] );
				}

				return return_results( 'SUCCESSFUL' );
			}
		case 'DELETE':
			{
				if( !pathParameters ){ return return_error( INVALID_REQUEST ); }

				// Validate delete message request ...
				if( !pathParameters.id ){ return return_error( 'Error, message id required.' ); }

				sql_statement = 'DELETE FROM tbl_message WHERE tbl_message_id = UUID_TO_BIN( ? ) AND tbl_message_owner = UUID_TO_BIN( ? )';

				return await execute_query( DB_NAME, event, sql_statement, [ pathParameters.id, user_id ] );
			}
	}

	return return_error( INVALID_REQUEST );
};


